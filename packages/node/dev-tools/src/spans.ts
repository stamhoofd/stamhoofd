import { isDevCollection, isDevCollections } from '@node/observability/db-collections';
import { channel } from 'node:diagnostics_channel';
/** Finished application operation, with no SDK objects, resource attributes or arbitrary labels. */
export type DevSpan = {
    service: 'api' | 'renderer' | 'stats'; name: string; kind: number; traceId: string; spanId: string; parentId?: string;
    startMs: number; durationMs: number; code: number; reason?: string; retry?: number; endpoint?: string; route?: string; operation?: string; collection?: string; collections?: string[]; method?: string; status?: number;
};
const fields = new Set(['service', 'name', 'kind', 'traceId', 'spanId', 'parentId', 'startMs', 'durationMs', 'code', 'reason', 'retry', 'route', 'endpoint', 'operation', 'collection', 'collections', 'method', 'status']);
const id = (v: unknown, size: number) => typeof v === 'string' && v.length === size && /^[a-f0-9]+$/.test(v) && !/^0+$/.test(v);
const optional = (v: unknown, allowed: string[]) => v === undefined || (typeof v === 'string' && allowed.includes(v));
export function isDevSpan(value: unknown): value is DevSpan {
    if (!value || typeof value !== 'object' || Object.keys(value).some(k => !fields.has(k))) return false;
    const s = value as DevSpan;
    return ['api', 'renderer', 'stats'].includes(s.service) && ['http.server.request', 'http.client.renderer', 'mysql.execute', 'mysql.acquire', 'queue.wait', 'queue.execute', 'invoice.upload', 'invoice.persist', 'storage.put', 'pdf.render', 'auth.authenticate', 'organization.resolve_scope', 'organization.assemble', 'organization.period_groups', 'organization.webshop_previews', 'statistics.cycle', 'statistics.incremental', 'statistics.deletes', 'statistics.settle'].includes(s.name)
        && [0, 1, 2].includes(s.kind) && id(s.traceId, 32) && id(s.spanId, 16) && (s.parentId === undefined || id(s.parentId, 16))
        && Number.isFinite(s.startMs) && s.startMs >= 0 && Number.isFinite(s.durationMs) && s.durationMs >= 0 && [0, 1, 2].includes(s.code)
        && (s.collection === undefined || (s.name === 'mysql.execute' && isDevCollection(s.collection)))
        && (s.endpoint === undefined || (s.name === 'http.server.request' && typeof s.endpoint === 'string' && /^[A-Z][A-Za-z0-9]{0,95}$/.test(s.endpoint)))
        && (s.collections === undefined || (s.name === 'mysql.execute' && s.collection === undefined && isDevCollections(s.collections)))
        && optional(s.route, ['/invoices', '/health', '/prerender', '/pdf-cache', '/html-to-pdf', '/organization', '/organization-from-domain', '/organization-from-uri', '/admin/organizations', '/admin/organizations/count']) && optional(s.reason, ['pool', 'execution', 'timeout', 'http_status', 'transport', 'render', 'upload', 'persistence', 'provider', 'cancelled']) && (s.retry === undefined || (Number.isInteger(s.retry) && s.retry >= 0 && s.retry <= 9)) && optional(s.operation, ['acquire', 'select', 'insert', 'update', 'delete', 'statement'])
        && optional(s.method, ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE', '_OTHER'])
        && (s.status === undefined || (Number.isInteger(s.status) && s.status >= 100 && s.status <= 599));
}

/** Pull subscriber: no delivery queue, timers or parent-first ordering requirement. */
export function subscribeDevSpans(session: string) {
    const events = channel('stamhoofd.dev.session.span');
    const traces = new Map<string, Map<string, DevSpan>>();
    function close() {
        events.unsubscribe(receive);
        traces.clear();
    }
    function receive(value: unknown) {
        if (!value || typeof value !== 'object' || !('session' in value) || value.session !== session) return;
        if ('closed' in value && value.closed === true) return close();
        if (!('span' in value) || !isDevSpan(value.span)) return;
        const span = value.span;
        let trace = traces.get(span.traceId);
        if (!trace) {
            if (traces.size === 8) {
                const oldest = traces.keys().next();
                if (!oldest.done) traces.delete(oldest.value);
            }
            traces.set(span.traceId, trace = new Map<string, DevSpan>());
        }
        if (trace.size < 128 && !trace.has(span.spanId)) trace.set(span.spanId, Object.freeze({ ...span }));
    }
    events.subscribe(receive);
    return { snapshot: () => [...traces.values()].map(trace => [...trace.values()]), close };
}
