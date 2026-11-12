import { context, logs, SeverityNumber, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

/**
 * Observes one server response without accepting headers, payloads, or raw URLs.
 * The optional route must be the framework's registered route template. Finish is
 * idempotent because Node may emit both finish and close for the same response.
 */
export function observeRequest(method: string): { finish(status: number, route?: string): void } {
    const span = trace.getTracer('@node/observability').startSpan('http.server.request', {
        kind: SpanKind.SERVER,
        attributes: {
            'http.request.method': [
                'GET',
                'HEAD',
                'POST',
                'PUT',
                'PATCH',
                'DELETE',
                'OPTIONS',
                'CONNECT',
                'TRACE',
            ].includes(method)
                ? method
                : '_OTHER',
        },
    });
    let ended = false;
    return {
        finish(status, route) {
            if (ended) return;
            ended = true;
            span.setAttribute('http.response.status_code', status);
            span.setAttribute('http.route', route ?? '(unmatched)');
            if (status >= 500) {
                span.setStatus({ code: SpanStatusCode.ERROR });
                logs.getLogger('@node/observability').emit({
                    body: 'http.server.failed',
                    severityNumber: SeverityNumber.ERROR,
                    context: trace.setSpan(context.active(), span),
                    attributes: { 'http.response.status_code': status },
                });
            }
            span.end();
        },
    };
}
