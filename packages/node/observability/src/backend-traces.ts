import { ROOT_CONTEXT, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Span, SpanContext, Tracer } from '@opentelemetry/api';
import { AsyncLocalStorage } from 'node:async_hooks';
import { channel } from 'node:diagnostics_channel';
import { boundedMethod } from './http-metrics.js';

type Operation =
    | 'http.server.request'
    | 'http.client.renderer'
    | 'mysql.execute'
    | 'statistics.cycle';
type LocalRequest = { localTraceQueued?: boolean };
type MatchedIdentity = { endpoint: string; route?: string };
type Owned = {
    name: Operation;
    kind: SpanKind;
    parent?: SpanContext;
    route?: string;
    db?: string;
    endpoint?: string;
    localRequest?: LocalRequest;
};
const owned = new WeakMap<object, Owned>();
const timings = channel('stamhoofd.database.duration');
const roles = ['api', 'renderer', 'stats', 'backup', 'redirecter'];
/** Only the actual SDK span created here can authorize parent linkage or route metadata at export. */
export function ownedOperation(span: object) {
    return owned.get(span);
}

const routes: Record<string, Record<string, string>> = {
    api: {
        PatchInvoicesEndpoint: '/invoices',
        GetInvoicesEndpoint: '/invoices',
        HealthEndpoint: '/health',
    },
    renderer: {
        HealthEndpoint: '/health',
        PrerenderEndpoint: '/prerender',
        PdfCacheEndpoint: '/pdf-cache',
    },
    backup: { BackupEndpoint: '/backup', HealthEndpoint: '/health' },
    redirecter: { RedirectEndpoint: '/*' },
};

// Each lane has its own context, admission decision, tracer and child budget.
function lane(role: string, tracer: Tracer, selection?: string) {
    let activeLocalRenders = 0;
    const current = new AsyncLocalStorage<{ span: Span; budget: { children: number } }>();
    const roots = { tokens: 2, lastRefill: 0 };
    const continuations = { tokens: 2, lastRefill: 0 };
    function start(meta: Owned, startTime?: number) {
        const span = tracer.startSpan(
            meta.name,
            { kind: meta.kind, startTime },
            meta.parent ? trace.setSpanContext(ROOT_CONTEXT, meta.parent) : ROOT_CONTEXT,
        );
        if (meta.route) span.setAttribute('http.route', meta.route);
        if (meta.db) span.setAttribute('db.operation.name', meta.db);
        owned.set(span, meta);
        return span;
    }

    function sample(bucket = roots) {
        const now = performance.now();
        bucket.tokens = Math.min(2, bucket.tokens + (now - bucket.lastRefill) / 10_000);
        bucket.lastRefill = now;
        if (bucket.tokens < 1) return false;
        bucket.tokens--;
        return true;
    }

    function databaseTime(message: unknown) {
        const work = current.getStore();
        if (
            !work ||
            !work.span.isRecording() ||
            work.budget.children <= 1 ||
            !message ||
            typeof message !== 'object'
        )
            return;
        const { operation, duration, outcome } = message as Record<string, unknown>;
        if (
            typeof operation !== 'string' ||
            !['select', 'insert', 'update', 'delete', 'statement'].includes(operation) ||
            typeof duration !== 'number' ||
            !Number.isFinite(duration) ||
            duration < 0 ||
            duration > 86_400_000 ||
            (outcome !== 'success' && outcome !== 'error')
        )
            return;
        work.budget.children--;
        const end = Date.now();
        const span = start(
            {
                name: 'mysql.execute',
                kind: SpanKind.CLIENT,
                parent: work.span.spanContext(),
                db: operation,
            },
            end - duration,
        );
        if (outcome === 'error') span.setStatus({ code: SpanStatusCode.ERROR });
        span.end(end);
    }

    async function run<T>(
        span: Span,
        work: () => Promise<T>,
        budget = { children: 32 },
    ): Promise<T> {
        try {
            return await current.run({ span, budget }, work);
        } catch (error) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
        } finally {
            span.end();
        }
    }

    /** Called only after Router.decode selected a registered endpoint. Public request headers never enter here. */
    function traceEndpoint<T extends { status: number }>(
        endpoint: object,
        method: string,
        handle: () => Promise<T>,
        request?: LocalRequest,
        identity?: MatchedIdentity,
    ): Promise<T> {
        const table = role && routes[role];
        if (!table || (role === 'renderer' && endpoint.constructor.name === 'HtmlToPdfEndpoint'))
            return handle();
        const route = Object.hasOwn(table, endpoint.constructor.name)
            ? table[endpoint.constructor.name]
            : undefined;
        if (
            selection
                ? selection !== '*' &&
                  (role !== 'api' || !route || selection !== `${method} ${route}`)
                : !sample()
        )
            return handle();
        const span = start({
            name: 'http.server.request',
            kind: SpanKind.SERVER,
            route: (selection && identity?.route) || route,
            endpoint:
                selection &&
                !route &&
                !identity?.route &&
                identity &&
                /^[A-Z][A-Za-z0-9]{0,95}$/.test(identity.endpoint)
                    ? identity.endpoint
                    : undefined,
            localRequest: selection ? request : undefined,
        });
        span.setAttribute('http.request.method', boundedMethod(method));
        return run(span, async () => {
            const response = await handle();
            span.setAttribute('http.response.status_code', response.status);
            if (response.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
            return response;
        });
    }

    function traceStatisticsCycle<T>(work: () => Promise<T>) {
        return !selection && role === 'stats' && sample()
            ? run(start({ name: 'statistics.cycle', kind: SpanKind.INTERNAL }), work)
            : work();
    }

    /** Dedicated API → renderer edge. Never propagate ambient context or arbitrary headers. */
    function traceRendererCall<T>(
        post: (parent: string | undefined, receivedStatus: (status: number) => void) => Promise<T>,
    ) {
        const work = current.getStore();
        if (role !== 'api' || !work?.span.isRecording() || work.budget.children <= 0)
            return post(undefined, () => {});
        work.budget.children--;
        const span = start({
            name: 'http.client.renderer',
            kind: SpanKind.CLIENT,
            parent: work.span.spanContext(),
        });
        return run(
            span,
            async () => {
                const ctx = span.spanContext();
                return post(
                    span.isRecording() && ctx.traceFlags === 1
                        ? `00-${ctx.traceId}-${ctx.spanId}-01`
                        : undefined,
                    (status) => {
                        span.setAttribute('http.response.status_code', status);
                        if (status >= 400) span.setStatus({ code: SpanStatusCode.ERROR });
                    },
                );
            },
            work.budget,
        );
    }

    /** The caller must authenticate the grant-bound traceparent before passing it here. No independent re-sampling. */
    function traceVerifiedRender<T>(
        parent: string | undefined,
        work: () => Promise<T>,
        request?: LocalRequest,
    ) {
        const match = role === 'renderer' && parent?.match(/^00-([a-f0-9]{32})-([a-f0-9]{16})-01$/);
        if (
            !match ||
            /^0+$/.test(match[1]) ||
            /^0+$/.test(match[2]) ||
            (selection ? activeLocalRenders >= 32 : !sample(continuations))
        )
            return work();
        const span = start({
            name: 'http.server.request',
            kind: SpanKind.SERVER,
            route: '/html-to-pdf',
            localRequest: selection ? request : undefined,
            parent: { traceId: match[1], spanId: match[2], traceFlags: 1, isRemote: true },
        });
        span.setAttribute('http.request.method', 'POST');
        if (!selection) return run(span, work);
        activeLocalRenders++;
        return run(span, work).finally(() => {
            activeLocalRenders--;
        });
    }

    timings.subscribe(databaseTime);
    return {
        traceEndpoint,
        traceRendererCall,
        traceVerifiedRender,
        traceStatisticsCycle,
        close() {
            timings.unsubscribe(databaseTime);
            current.disable();
        },
    };
}
let production: ReturnType<typeof lane> | undefined;
let local: ReturnType<typeof lane> | undefined;

export function enableBackendTraces(service: string) {
    if (!roles.includes(service)) return;
    production = lane(service, trace.getTracer('@node/observability/backend'));
    return () => {
        production?.close();
        production = undefined;
    };
}

export function enableLocalTraces(service: string, tracer: Tracer, selection: string) {
    local = lane(service, tracer, selection);
    return () => {
        local?.close();
        local = undefined;
    };
}

export function traceEndpoint<T extends { status: number }>(
    endpoint: object,
    method: string,
    handle: () => Promise<T>,
    request?: LocalRequest,
    identity?: MatchedIdentity,
) {
    const work = local
        ? () => local!.traceEndpoint(endpoint, method, handle, request, identity)
        : handle;
    return production ? production.traceEndpoint(endpoint, method, work) : work();
}
export function traceStatisticsCycle<T>(work: () => Promise<T>) {
    return production ? production.traceStatisticsCycle(work) : work();
}
export function traceRendererCall<T>(
    post: (
        parent: string | undefined,
        status: (value: number) => void,
        localParent?: string,
    ) => Promise<T>,
) {
    const work = (parent: string | undefined, status: (value: number) => void) =>
        local
            ? local.traceRendererCall((localParent, localStatus) =>
                  post(
                      parent,
                      (value) => {
                          status(value);
                          localStatus(value);
                      },
                      localParent,
                  ),
              )
            : post(parent, status);
    return production ? production.traceRendererCall(work) : work(undefined, () => {});
}
export function traceVerifiedRender<T>(
    parent: string | undefined,
    handle: () => Promise<T>,
    localParent?: string,
    request?: LocalRequest,
) {
    const work = local ? () => local!.traceVerifiedRender(localParent, handle, request) : handle;
    return production ? production.traceVerifiedRender(parent, work) : work();
}
