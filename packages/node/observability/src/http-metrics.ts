import type { Meter, MetricOptions } from '@opentelemetry/api';
import { errorMonitor } from 'node:events';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

function instruments(meter: Meter, options: MetricOptions) {
    return {
        active: meter.createUpDownCounter('stamhoofd.http.requests.in_flight'),
        duration: meter.createHistogram('stamhoofd.http.request.duration.milliseconds', options),
    };
}

let http: ReturnType<typeof instruments> | undefined;
export function enableHttpMetrics(meter: Meter, options: MetricOptions) {
    http = instruments(meter, options);
}
export function disableHttpMetrics() {
    http = undefined;
}

/** Observe the final wire status or a premature close, never request content or route names. */
function measureHttpResponse(method: string | undefined, response: ServerResponse) {
    const metrics = http;
    if (!metrics) return;
    const start = performance.now();
    metrics.active.add(1);
    const finish = () => {
        response.off('finish', finish);
        response.off('close', finish);
        response.off(errorMonitor, finish);
        metrics.active.add(-1);
        const code = response.statusCode;
        const statusClass = !response.writableFinished
            ? 'aborted'
            : code >= 100 && code < 600
              ? `${Math.floor(code / 100)}xx`
              : 'other';
        metrics.duration.record(performance.now() - start, {
            method: boundedMethod(method),
            status_class: statusClass,
        });
    };
    response.once('finish', finish);
    response.once('close', finish);
    response.once(errorMonitor, finish);
}

const methods = new Set([
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    'CONNECT',
    'TRACE',
]);
export function boundedMethod(method: string | undefined) {
    return method && methods.has(method) ? method : '_OTHER';
}

function onRequest(req: IncomingMessage, res: ServerResponse) {
    measureHttpResponse(req.method, res);
}

/** Register an HTTP producer even when its framework only exposes individual requests. */
export function observeHttpResponses() {
    if (!http) return;
    http.active.add(0);
    return measureHttpResponse;
}

/** Attach before the listener serves traffic. The metrics scrape server is never registered. */
export function observeHttpServer(server: Server | undefined) {
    if (!server || server.listeners('request').includes(onRequest) || !observeHttpResponses())
        return;
    server.prependListener('request', onRequest);
}
