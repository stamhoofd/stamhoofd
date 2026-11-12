import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { randomUUID } from 'node:crypto';
import { sanitizedLogExporter, sanitizedTraceExporter } from './exporters.js';

let runtime: { shutdown(): Promise<void> } | undefined;

/**
 * Initializes one process-owned SDK before application instrumentation runs.
 * Export is opt-in through OTLP endpoint variables. Uses HTTP/protobuf, with no
 * automatic request, console, host, or process instrumentation. Credentials are
 * read by the exporters at runtime. Shutdown is idempotent and bounded to 2s.
 */
export function initializeTelemetry(service: string): { shutdown(): Promise<void> } {
    if (runtime) return runtime;
    let sdk: NodeSDK | undefined;
    let shutdown: Promise<void> | undefined;
    const configured = (signal: 'TRACES' | 'LOGS') =>
        !!(
            process.env[`OTEL_EXPORTER_OTLP_${signal}_ENDPOINT`] ||
            process.env.OTEL_EXPORTER_OTLP_ENDPOINT
        );
    const resource: Record<string, string> = {
        'service.name': process.env.OTEL_SERVICE_NAME || service,
        'service.instance.id': randomUUID(),
    };
    for (const field of (process.env.OTEL_RESOURCE_ATTRIBUTES ?? '').split(',')) {
        const separator = field.indexOf('=');
        const key = field.slice(0, separator).trim();
        if (['service.version', 'deployment.environment.name'].includes(key))
            resource[key] = field.slice(separator + 1).trim();
    }
    try {
        sdk = new NodeSDK({
            autoDetectResources: false,
            resource: resourceFromAttributes(resource),
            instrumentations: [],
            metricReaders: [],
            spanProcessors: configured('TRACES')
                ? [
                      new BatchSpanProcessor({
                          exporter: sanitizedTraceExporter(
                              new OTLPTraceExporter({ timeoutMillis: 1500 }),
                          ),
                      }),
                  ]
                : [],
            logRecordProcessors: configured('LOGS')
                ? [
                      new BatchLogRecordProcessor({
                          exporter: sanitizedLogExporter(
                              new OTLPLogExporter({ timeoutMillis: 1500 }),
                          ),
                      }),
                  ]
                : [],
        });
        sdk.start();
    } catch {
        console.warn('Application telemetry could not be initialized.');
    }
    runtime = {
        shutdown() {
            return (shutdown ??= (async () => {
                let timer: NodeJS.Timeout | undefined;
                try {
                    await Promise.race([
                        Promise.resolve().then(() => sdk?.shutdown()),
                        new Promise<void>((resolve) => {
                            timer = setTimeout(resolve, 2000);
                        }),
                    ]);
                } catch {
                    console.warn('Application telemetry could not be flushed.');
                } finally {
                    if (timer) clearTimeout(timer);
                }
            })());
        },
    };
    return runtime;
}
