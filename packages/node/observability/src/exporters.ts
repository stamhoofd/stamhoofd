import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace';
import type { LogRecordExporter } from '@opentelemetry/sdk-logs';
import { SpanKind, SpanStatusCode, TraceFlags } from '@opentelemetry/api';
import type { Attributes, HrTime } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { boundedMethod } from './http-metrics.js';
import { ownedOperation } from './backend-traces.js';

const traceServices = new Set(['api', 'renderer', 'backup', 'redirecter', 'stats', 'docs']);
const logBodies = new Set([
    'application.ready',
    'application.startup.failed',
    'application.stopped',
    'http.server.failed',
]);

/** Only explicitly selected server fields cross the export boundary. */
function attributes(input: Attributes): Attributes {
    const result: Attributes = {};
    if (input['application.outcome'] === 'cancelled') result['application.outcome'] = 'cancelled';
    const method = input['http.request.method'];
    if (
        typeof method === 'string' &&
        [
            'GET',
            'HEAD',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS',
            'CONNECT',
            'TRACE',
            '_OTHER',
        ].includes(method)
    )
        result['http.request.method'] = method;
    const status = input['http.response.status_code'];
    if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599)
        result['http.response.status_code'] = status;
    // Routes must be framework-owned templates, never a request path or URL.
    const route = input['http.route'];
    if (typeof route === 'string' && route.length <= 256 && !/[?#\r\n]/.test(route))
        result['http.route'] = route;
    return result;
}

function time([seconds, nanos]: HrTime): HrTime | undefined {
    if (
        Number.isSafeInteger(seconds) &&
        seconds >= 0 &&
        seconds <= 0xffffffff &&
        Number.isInteger(nanos) &&
        nanos >= 0 &&
        nanos < 1e9
    )
        return [seconds, nanos];
}

// This is an export policy, not a list derived from the producers. New operations
// stay local until their name, fields and failure vocabulary have been reviewed.
const operationReasons: Readonly<Record<string, readonly string[]>> = {
    'auth.authenticate': ['execution'],
    'organization.resolve_scope': ['execution'],
    'organization.assemble': ['execution'],
    'organization.period_groups': ['execution'],
    'organization.webshop_previews': ['execution'],
    'http.server.request': [],
    'http.client.renderer': ['timeout', 'transport', 'http_status'],
    'mysql.acquire': ['pool'],
    'mysql.execute': ['execution'],
    'queue.wait': ['cancelled'],
    'queue.execute': ['cancelled', 'execution'],
    'invoice.upload': ['upload'],
    'invoice.persist': ['persistence'],
    'storage.put': ['timeout', 'http_status', 'provider'],
    'pdf.render': ['render'],
    'statistics.cycle': [],
    'statistics.incremental': ['execution'],
    'statistics.deletes': ['execution'],
    'statistics.settle': ['execution'],
};

/** Only our instrumented operations can authorize a child edge; public scope/name strings cannot. */
export function sanitizedTraceExporter(destination: SpanExporter, service: string): SpanExporter {
    const resource = resourceFromAttributes({ 'service.name': service });
    function project(span: ReadableSpan): ReadableSpan | undefined {
        const name = span.name;
        const meta = ownedOperation(span);
        if (
            span.instrumentationScope.name !==
                (meta ? '@node/observability/backend' : '@node/observability') ||
            !span.ended ||
            (meta
                ? name !== meta.name || !Object.hasOwn(operationReasons, name)
                : name !== 'application.startup' && name !== 'http.server.request')
        )
            return;
        const { traceId, spanId, isRemote, traceFlags } = span.spanContext();
        const parent = meta?.parent;
        if (
            parent
                ? parent.traceId !== traceId ||
                  parent.spanId !== span.parentSpanContext?.spanId ||
                  !/^[a-f0-9]{16}$/.test(parent.spanId) ||
                  /^0+$/.test(parent.spanId)
                : span.parentSpanContext
        )
            return;
        if (
            isRemote ||
            traceFlags !== Number(TraceFlags.SAMPLED) ||
            typeof traceId !== 'string' ||
            !/^[a-f0-9]{32}$/.test(traceId) ||
            /^0+$/.test(traceId) ||
            typeof spanId !== 'string' ||
            !/^[a-f0-9]{16}$/.test(spanId) ||
            /^0+$/.test(spanId)
        )
            return;
        const startTime = time(span.startTime),
            endTime = time(span.endTime),
            duration = time(span.duration);
        const code = span.status.code;
        if (
            !startTime ||
            !endTime ||
            !duration ||
            ![SpanStatusCode.UNSET, SpanStatusCode.OK, SpanStatusCode.ERROR].includes(code)
        )
            return;
        const safe: Attributes = {};
        const kind =
            meta?.kind ?? (name === 'http.server.request' ? SpanKind.SERVER : SpanKind.INTERNAL);
        if (span.kind !== kind) return;
        if (meta?.route && name === 'http.server.request') safe['http.route'] = meta.route;
        if (meta?.db && (name === 'mysql.acquire' || name === 'mysql.execute'))
            safe['db.operation.name'] = meta.db;
        if (
            meta?.reason &&
            code === SpanStatusCode.ERROR &&
            operationReasons[name].includes(meta.reason)
        )
            safe['error.type'] = meta.reason;
        if (
            meta?.retry !== undefined &&
            (name === 'pdf.render' || name === 'storage.put') &&
            Number.isInteger(meta.retry) &&
            meta.retry >= 0 &&
            meta.retry <= (name === 'pdf.render' ? 2 : 9)
        )
            safe['retry.count'] = meta.retry;
        if (kind === SpanKind.SERVER || name === 'http.client.renderer') {
            const method = span.attributes['http.request.method'];
            if (typeof method === 'string') safe['http.request.method'] = boundedMethod(method);
        }
        if (kind === SpanKind.SERVER || name === 'http.client.renderer' || name === 'storage.put') {
            const status = span.attributes['http.response.status_code'];
            if (
                typeof status === 'number' &&
                Number.isInteger(status) &&
                status >= 100 &&
                status <= 599
            )
                safe['http.response.status_code'] = status;
        } else if (
            name === 'application.startup' &&
            span.attributes['application.outcome'] === 'cancelled'
        )
            safe['application.outcome'] = 'cancelled';
        return {
            name,
            kind,
            startTime,
            endTime,
            duration,
            ended: true,
            resource,
            spanContext: () => ({ traceId, spanId, traceFlags: TraceFlags.SAMPLED }),
            parentSpanContext: parent && {
                traceId,
                spanId: parent.spanId,
                traceFlags: TraceFlags.SAMPLED,
                isRemote: parent.isRemote === true,
            },
            instrumentationScope: { name: '@node/observability' },
            attributes: safe,
            status: { code },
            events: [],
            links: [],
            droppedAttributesCount: 0,
            droppedLinksCount: 0,
            droppedEventsCount: 0,
        };
    }
    return {
        export(spans, callback) {
            const safe: ReadableSpan[] = [];
            try {
                if (traceServices.has(service)) {
                    for (const span of spans) {
                        const result = project(span);
                        if (result) safe.push(result);
                    }
                }
                if (!safe.length) return callback({ code: 0 });
                destination.export(safe, (result) => callback({ code: result.code }));
            } catch {
                callback({ code: 1 });
            }
        },
        shutdown: () => destination.shutdown(),
        forceFlush: () => destination.forceFlush?.() ?? Promise.resolve(),
    };
}

/** Fixed lifecycle/error identifiers only; console text and raw exceptions are excluded. */
export function sanitizedLogExporter(destination: LogRecordExporter): LogRecordExporter {
    return {
        export(records, callback) {
            destination.export(
                records
                    .filter(
                        (record) =>
                            record.instrumentationScope.name === '@node/observability' &&
                            typeof record.body === 'string' &&
                            logBodies.has(record.body),
                    )
                    .map((record) => ({
                        hrTime: record.hrTime,
                        hrTimeObserved: record.hrTimeObserved,
                        spanContext: record.spanContext,
                        severityNumber: record.severityNumber,
                        body: record.body,
                        resource: record.resource,
                        instrumentationScope: { name: '@node/observability' },
                        attributes: attributes(record.attributes),
                        droppedAttributesCount: record.droppedAttributesCount,
                    })),
                callback,
            );
        },
        shutdown: () => destination.shutdown(),
        forceFlush: () => destination.forceFlush(),
    };
}
