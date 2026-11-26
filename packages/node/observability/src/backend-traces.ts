import { ROOT_CONTEXT, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Span, SpanContext } from '@opentelemetry/api';
import { AsyncLocalStorage } from 'node:async_hooks';
import { channel } from 'node:diagnostics_channel';
import { boundedMethod } from './http-metrics.js';

type Operation =
    | 'http.server.request'
    | 'http.client.renderer'
    | 'mysql.execute'
    | 'statistics.cycle';
type Owned = { name: Operation; kind: SpanKind; parent?: SpanContext; route?: string; db?: string };
const owned = new WeakMap<object, Owned>();
const current = new AsyncLocalStorage<{ span: Span; budget: { children: number } }>();
const timings = channel('stamhoofd.database.duration');
const roles = ['api', 'renderer', 'stats', 'backup', 'redirecter'];
let role: string | undefined;
const roots = { tokens: 2, lastRefill: 0 };
const continuations = { tokens: 2, lastRefill: 0 };

/** Only the actual SDK span created here can authorize parent linkage or route metadata at export. */
export function ownedOperation(span: object) {
    return owned.get(span);
}

function start(meta: Owned, startTime?: number) {
    const span = trace
        .getTracer('@node/observability/backend')
        .startSpan(
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
    if (!role) return false;
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

/** Enabled only by the executable's explicit trace endpoint, independent of the metrics subscriber. */
export function enableBackendTraces(service: string) {
    if (!roles.includes(service)) return;
    role = service;
    timings.subscribe(databaseTime);
    return () => {
        role = undefined;
        timings.unsubscribe(databaseTime);
    };
}

async function run<T>(span: Span, work: () => Promise<T>, budget = { children: 32 }): Promise<T> {
    try {
        return await current.run({ span, budget }, work);
    } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
    } finally {
        span.end();
    }
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

/** Called only after Router.decode selected a registered endpoint. Public request headers never enter here. */
export function traceEndpoint<T extends { status: number }>(
    endpoint: object,
    method: string,
    handle: () => Promise<T>,
): Promise<T> {
    const table = role && routes[role];
    if (
        !table ||
        (role === 'renderer' && endpoint.constructor.name === 'HtmlToPdfEndpoint') ||
        !sample()
    )
        return handle();
    const route = Object.hasOwn(table, endpoint.constructor.name)
        ? table[endpoint.constructor.name]
        : undefined;
    const span = start({ name: 'http.server.request', kind: SpanKind.SERVER, route });
    span.setAttribute('http.request.method', boundedMethod(method));
    return run(span, async () => {
        const response = await handle();
        span.setAttribute('http.response.status_code', response.status);
        if (response.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
        return response;
    });
}

export function traceStatisticsCycle<T>(work: () => Promise<T>) {
    return role === 'stats' && sample()
        ? run(start({ name: 'statistics.cycle', kind: SpanKind.INTERNAL }), work)
        : work();
}

/** Dedicated API → renderer edge. Never propagate ambient context or arbitrary headers. */
export function traceRendererCall<T>(
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
export function traceVerifiedRender<T>(parent: string | undefined, work: () => Promise<T>) {
    const match = role === 'renderer' && parent?.match(/^00-([a-f0-9]{32})-([a-f0-9]{16})-01$/);
    if (!match || /^0+$/.test(match[1]) || /^0+$/.test(match[2]) || !sample(continuations))
        return work();
    const span = start({
        name: 'http.server.request',
        kind: SpanKind.SERVER,
        route: '/html-to-pdf',
        parent: { traceId: match[1], spanId: match[2], traceFlags: 1, isRemote: true },
    });
    span.setAttribute('http.request.method', 'POST');
    return run(span, work);
}
