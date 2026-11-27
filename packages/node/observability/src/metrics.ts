import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { channel } from 'node:diagnostics_channel';
import { enableHttpMetrics, disableHttpMetrics } from './http-metrics.js';

/** A private provider keeps third-party instruments off the scrape endpoint. */
export function initializeMetrics(service: string) {
    const configured = process.env.STAM_METRICS_PORT;
    if (!configured) return;
    const port = Number(configured);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.warn('Invalid STAM_METRICS_PORT; application metrics are disabled.');
        return;
    }
    const reader = new PrometheusExporter({
        host: '127.0.0.1',
        port,
        preventServerStart: true,
        withoutTargetInfo: true,
        withoutScopeInfo: true,
        withResourceConstantLabels: /^service\.name$/,
    });
    const provider = new MeterProvider({
        resource: resourceFromAttributes({
            'service.name': process.env.OTEL_SERVICE_NAME || service,
        }),
        readers: [reader],
    });
    const meter = provider.getMeter('@node/observability');
    const options = {
        unit: 'ms',
        advice: { explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 30000] },
    };
    const acquire = meter.createHistogram('stamhoofd.db.acquire.duration.milliseconds', options);
    const execute = meter.createHistogram('stamhoofd.db.execute.duration.milliseconds', options);
    const timings = channel('stamhoofd.database.duration');
    const record = (event: unknown) => {
        if (!event || typeof event !== 'object') return;
        const { duration, outcome, operation } = event as Record<string, unknown>;
        if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) return;
        if (outcome !== 'success' && outcome !== 'error') return;
        if (operation === 'acquire') acquire.record(duration, { outcome });
        else if (
            typeof operation === 'string' &&
            ['select', 'insert', 'update', 'delete', 'statement'].includes(operation)
        )
            execute.record(duration, { operation, outcome });
    };
    enableHttpMetrics(meter, options);
    timings.subscribe(record);
    const unsubscribe = () => {
        disableHttpMetrics();
        timings.unsubscribe(record);
    };
    const started = reader.startServer().catch(() => {
        unsubscribe();
        console.warn('Application metrics listener could not be started.');
    });
    return {
        async shutdown() {
            unsubscribe();
            await started;
            await provider.shutdown();
        },
    };
}
