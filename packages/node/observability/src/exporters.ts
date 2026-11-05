import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace';
import type { LogRecordExporter } from '@opentelemetry/sdk-logs';
import type { Attributes } from '@opentelemetry/api';

const spanNames = new Set(['application.startup', 'application.shutdown', 'http.server.request']);
const logBodies = new Set(['application.ready', 'application.startup.failed', 'application.stopped', 'http.server.failed']);

/** Only explicitly selected server fields cross the export boundary. */
function attributes(input: Attributes): Attributes {
    const result: Attributes = {};
    if (input['application.outcome'] === 'cancelled') result['application.outcome'] = 'cancelled';
    const method = input['http.request.method'];
    if (typeof method === 'string' && ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE', '_OTHER'].includes(method)) result['http.request.method'] = method;
    const status = input['http.response.status_code'];
    if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) result['http.response.status_code'] = status;
    // Routes must be framework-owned templates, never a request path or URL.
    const route = input['http.route'];
    if (typeof route === 'string' && route.length <= 256 && !/[?#\r\n]/.test(route)) result['http.route'] = route;
    return result;
}

/** Restricts the initial pilot to our manually instrumented server operations. */
export function sanitizedTraceExporter(destination: SpanExporter): SpanExporter {
    return {
        export(spans, callback) {
            const safe: ReadableSpan[] = spans
                .filter(span => span.instrumentationScope.name === '@node/observability' && spanNames.has(span.name))
                .map(span => ({
                    name: span.name,
                    kind: span.kind,
                    spanContext: () => span.spanContext(),
                    parentSpanContext: span.parentSpanContext,
                    startTime: span.startTime,
                    endTime: span.endTime,
                    duration: span.duration,
                    ended: span.ended,
                    resource: span.resource,
                    instrumentationScope: { name: '@node/observability' },
                    attributes: attributes(span.attributes),
                    status: { code: span.status.code },
                    events: [],
                    links: [],
                    droppedAttributesCount: span.droppedAttributesCount,
                    droppedEventsCount: span.droppedEventsCount,
                    droppedLinksCount: span.droppedLinksCount,
                }));
            destination.export(safe, callback);
        },
        shutdown: () => destination.shutdown(),
        forceFlush: () => destination.forceFlush?.() ?? Promise.resolve(),
    };
}

/** Fixed lifecycle/error identifiers only; console text and raw exceptions are excluded. */
export function sanitizedLogExporter(destination: LogRecordExporter): LogRecordExporter {
    return {
        export(records, callback) {
            destination.export(records
                .filter(record => record.instrumentationScope.name === '@node/observability' && typeof record.body === 'string' && logBodies.has(record.body))
                .map(record => ({
                    hrTime: record.hrTime,
                    hrTimeObserved: record.hrTimeObserved,
                    spanContext: record.spanContext,
                    severityNumber: record.severityNumber,
                    body: record.body,
                    resource: record.resource,
                    instrumentationScope: { name: '@node/observability' },
                    attributes: attributes(record.attributes),
                    droppedAttributesCount: record.droppedAttributesCount,
                })), callback);
        },
        shutdown: () => destination.shutdown(),
        forceFlush: () => destination.forceFlush(),
    };
}
