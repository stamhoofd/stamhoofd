import { AlwaysOnSampler, TracerProvider } from '@opentelemetry/sdk-trace';
import { channel } from 'node:diagnostics_channel';
import { enableLocalTraces, ownedOperation } from './backend-traces.js';
import { boundedMethod } from './http-metrics.js';

/** A dev-session subscriber owns this private provider. Never register it globally or install an exporter. */
export function startLocalCapture(service: string) {
    const output = channel('stamhoofd.dev.span.finished');
    const selection = process.env.STAM_DEV_CAPTURE;
    if (
        !selection ||
        !process.env.STAM_DEV_SESSION ||
        !process.env.STAM_DEV_SOCKET ||
        process.env.STAM_DEV_APP !== service ||
        !['api', 'renderer'].includes(service) ||
        !output.hasSubscribers
    )
        return;
    const provider = new TracerProvider({
        sampler: new AlwaysOnSampler(),
        spanProcessors: [
            {
                onStart() {},
                onEnd(span) {
                    const op = ownedOperation(span);
                    if (!op) return;
                    const { traceId, spanId } = span.spanContext();
                    const method = span.attributes['http.request.method'];
                    const status = span.attributes['http.response.status_code'];
                    const queued = Symbol.for('stamhoofd.dev.span.queued');
                    const frame = {
                        [queued]: false,
                        service,
                        traceId,
                        spanId,
                        parentId: op.parent?.spanId,
                        name: op.name,
                        kind: op.kind,
                        startMs: span.startTime[0] * 1000 + span.startTime[1] / 1e6,
                        durationMs: span.duration[0] * 1000 + span.duration[1] / 1e6,
                        code: span.status.code,
                        route: op.route,
                        endpoint: op.endpoint,
                        operation: op.db,
                        method: typeof method === 'string' ? boundedMethod(method) : undefined,
                        status:
                            typeof status === 'number' &&
                            Number.isInteger(status) &&
                            status >= 100 &&
                            status <= 599
                                ? status
                                : undefined,
                    };
                    output.publish(frame);
                    if (op.localRequest && frame[queued]) op.localRequest.localTraceQueued = true;
                },
                async shutdown() {},
                async forceFlush() {},
            },
        ],
    });
    const stop = enableLocalTraces(
        service,
        provider.getTracer('@node/observability/backend'),
        selection,
    );
    return async () => {
        stop();
        await provider.shutdown();
    };
}
