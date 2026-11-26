import { isDevCollection, isDevCollections } from './db-collections.js';
import {
    isSpanContextValid,
    ROOT_CONTEXT,
    SpanKind,
    SpanStatusCode,
    trace,
    TraceFlags,
} from '@opentelemetry/api';
import type { Span, SpanContext, Tracer } from '@opentelemetry/api';
import { AsyncLocalStorage } from 'node:async_hooks';
import { channel } from 'node:diagnostics_channel';
import { requestSpanIds } from './request-span-state.js';
import { boundedMethod } from './http-metrics.js';
import { captureEndpoints, statisticsCycle } from './dev-capture-selectors.js';

const stages = {
    'auth.authenticate': 'execution',
    'organization.resolve_scope': 'execution',
    'organization.assemble': 'execution',
    'organization.period_groups': 'execution',
    'organization.webshop_previews': 'execution',

    'queue.execute': 'execution',
    'invoice.upload': 'upload',
    'invoice.persist': 'persistence',
    'storage.put': 'provider',
    'pdf.render': 'render',
    'statistics.incremental': 'execution',
    'statistics.deletes': 'execution',
    'statistics.settle': 'execution',
} as const;
type Stage = keyof typeof stages;
type StageOptions = { retry?: number; isAborted?: (e: unknown) => boolean };
type Reason =
    | (typeof stages)[Stage]
    | 'pool'
    | 'timeout'
    | 'transport'
    | 'http_status'
    | 'cancelled';
type Operation =
    | Stage
    | 'queue.wait'
    | 'mysql.acquire'
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
    collection?: string;
    collections?: string[];
    reason?: Reason;
    retry?: number;
};
const owned = new WeakMap<object, Owned>();
const timings = channel('stamhoofd.database.duration');
const roles = ['api', 'renderer', 'stats', 'backup', 'redirecter'];
/** Only the actual SDK span created here can authorize parent linkage or route metadata at export. */
export function ownedOperation(span: object) {
    return owned.get(span);
}

const routes: Record<string, Record<string, string>> = {
    api: Object.fromEntries(
        Object.entries(captureEndpoints).map(([name, { route }]) => [name, route]),
    ),
    renderer: {
        HealthEndpoint: '/health',
        PrerenderEndpoint: '/prerender',
        PdfCacheEndpoint: '/pdf-cache',
    },
    backup: { BackupEndpoint: '/backup', HealthEndpoint: '/health' },
    redirecter: { RedirectEndpoint: '/*' },
};

// Each lane has its own context, admission decision, tracer and child budget.
function lane(role: string, tracer: Tracer, selection?: string, correlateResponses = false) {
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
        if (meta.collection) span.setAttribute('db.collection.name', meta.collection);
        if (meta.collections) span.setAttribute('stamhoofd.db.collections', meta.collections);
        owned.set(span, meta);
        return span;
    }

    function associate(request: object | undefined, span: Span) {
        if (!correlateResponses || !request || !span.isRecording()) return;
        const ctx = span.spanContext();
        if (!ctx.isRemote && ctx.traceFlags & TraceFlags.SAMPLED && isSpanContextValid(ctx)) {
            requestSpanIds.set(
                request,
                Object.freeze({ trace_id: ctx.traceId, span_id: ctx.spanId }),
            );
        }
    }

    function sample(bucket = roots) {
        const now = performance.now();
        bucket.tokens = Math.min(2, bucket.tokens + (now - bucket.lastRefill) / 10_000);
        bucket.lastRefill = now;
        if (bucket.tokens < 1) return false;
        bucket.tokens--;
        return true;
    }

    function fail(span: Span, reason: Reason) {
        owned.get(span)!.reason = reason;
        span.setAttribute('error.type', reason);
        span.setStatus({ code: SpanStatusCode.ERROR });
    }

    function child(name: Operation, kind: SpanKind, reserve: number) {
        const work = current.getStore();
        if (!work?.span.isRecording() || work.budget.children <= reserve) return;
        work.budget.children--;
        return {
            span: start({ name, kind, parent: work.span.spanContext() }),
            budget: work.budget,
        };
    }

    // AWS metadata may be absent on transport failures. Read only bounded numeric values;
    // instrumenting an unexpected rejection must never replace the original rejection.
    function storageOutcome(span: Span, value: unknown): Reason {
        try {
            const sdk = value as {
                name?: unknown;
                code?: unknown;
                $metadata?: { attempts?: unknown; httpStatusCode?: unknown };
            } | null;
            const attempts = sdk?.$metadata?.attempts,
                status = sdk?.$metadata?.httpStatusCode;
            if (typeof attempts === 'number' && Number.isSafeInteger(attempts) && attempts >= 1) {
                const retry = Math.min(attempts - 1, 9);
                owned.get(span)!.retry = retry;
                span.setAttribute('retry.count', retry);
            }
            if (
                typeof status === 'number' &&
                Number.isInteger(status) &&
                status >= 100 &&
                status <= 599
            ) {
                span.setAttribute('http.response.status_code', status);
                if (status >= 400) return 'http_status';
            }
            if (sdk?.name === 'TimeoutError' || sdk?.code === 'ETIMEDOUT') return 'timeout';
        } catch {
            /* Non-SDK rejection. */
        }
        return 'provider';
    }
    function stage<T>(name: Stage, handle: () => Promise<T>, options?: StageOptions) {
        const work = child(
            name,
            name === 'storage.put' ? SpanKind.CLIENT : SpanKind.INTERNAL,
            name === 'queue.execute' ? 8 : 0,
        );
        if (!work) return handle();
        const retry = options?.retry;
        if (retry !== undefined && Number.isInteger(retry) && retry >= 0 && retry <= 2) {
            owned.get(work.span)!.retry = retry;
            work.span.setAttribute('retry.count', retry);
        }
        return run(
            work.span,
            async () => {
                try {
                    const result = await handle();
                    if (
                        name === 'storage.put' &&
                        storageOutcome(work.span, result) === 'http_status'
                    )
                        fail(work.span, 'http_status');
                    if (name === 'pdf.render' && result === null) fail(work.span, 'render');
                    return result;
                } catch (e) {
                    fail(
                        work.span,
                        name === 'storage.put'
                            ? storageOutcome(work.span, e)
                            : name === 'queue.execute' && options?.isAborted?.(e)
                              ? 'cancelled'
                              : stages[name],
                    );
                    throw e;
                }
            },
            work.budget,
        );
    }

    function wait() {
        const work = child('queue.wait', SpanKind.INTERNAL, 8);
        if (work)
            return (cancelled: boolean) => {
                if (cancelled) fail(work.span, 'cancelled');
                work.span.end();
            };
    }
    function databaseTime(message: unknown) {
        const work = current.getStore();
        if (
            !work ||
            !work.span.isRecording() ||
            work.budget.children <= 8 ||
            !message ||
            typeof message !== 'object'
        )
            return;
        const { operation, duration, outcome, collection, collections } = message as Record<
            string,
            unknown
        >;
        if (
            typeof operation !== 'string' ||
            !['acquire', 'select', 'insert', 'update', 'delete', 'statement'].includes(operation) ||
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
                name: operation === 'acquire' ? 'mysql.acquire' : 'mysql.execute',
                kind: SpanKind.CLIENT,
                parent: work.span.spanContext(),
                db: operation,
                collections:
                    selection && operation !== 'acquire' && isDevCollections(collections)
                        ? collections
                        : undefined,
                collection:
                    selection && operation !== 'acquire' && isDevCollection(collection)
                        ? collection
                        : undefined,
            },
            end - duration,
        );
        if (outcome === 'error') fail(span, operation === 'acquire' ? 'pool' : 'execution');
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
        associate(request, span);
        span.setAttribute('http.request.method', boundedMethod(method));
        return run(span, async () => {
            const response = await handle();
            span.setAttribute('http.response.status_code', response.status);
            if (response.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
            return response;
        });
    }

    function traceStatisticsCycle<T>(work: () => Promise<T>) {
        const admit =
            role === 'stats' &&
            (selection ? selection === '*' || selection === statisticsCycle : sample());
        return admit
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
                try {
                    return await post(
                        span.isRecording() && ctx.traceFlags === 1
                            ? `00-${ctx.traceId}-${ctx.spanId}-01`
                            : undefined,
                        (status) => {
                            span.setAttribute('http.response.status_code', status);
                            if (status !== 200) fail(span, 'http_status');
                        },
                    );
                } catch (error) {
                    if (!owned.get(span)?.reason)
                        fail(
                            span,
                            error instanceof DOMException && error.name === 'AbortError'
                                ? 'timeout'
                                : 'transport',
                        );
                    throw error;
                }
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
        associate(request, span);
        span.setAttribute('http.request.method', 'POST');
        if (!selection) return run(span, work);
        activeLocalRenders++;
        return run(span, work).finally(() => {
            activeLocalRenders--;
        });
    }

    timings.subscribe(databaseTime);
    return {
        stage,
        wait,
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

export function enableBackendTraces(service: string, correlateResponses = false) {
    if (!roles.includes(service)) return;
    production = lane(
        service,
        trace.getTracer('@node/observability/backend'),
        undefined,
        correlateResponses,
    );
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
    return production ? production.traceEndpoint(endpoint, method, work, request) : work();
}
export function traceStatisticsCycle<T>(work: () => Promise<T>) {
    const handle = local ? () => local!.traceStatisticsCycle(work) : work;
    return production ? production.traceStatisticsCycle(handle) : handle();
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
    return production ? production.traceVerifiedRender(parent, work, request) : work();
}

/** Fixed application-owned boundaries only. No dynamic operation names or exception text. */
export function traceStage<T>(name: Stage, handle: () => Promise<T>, options?: StageOptions) {
    if (!Object.hasOwn(stages, name)) return handle();
    const work = local ? () => local!.stage(name, handle, options) : handle;
    return production ? production.stage(name, work, options) : work();
}

export function traceQueueWait() {
    const remoteWait = production?.wait(),
        localWait = local?.wait();
    if (remoteWait || localWait)
        return (cancelled: boolean) => {
            remoteWait?.(cancelled);
            localWait?.(cancelled);
        };
}
