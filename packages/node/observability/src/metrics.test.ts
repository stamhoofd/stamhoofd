import { channel } from 'node:diagnostics_channel';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { expect, it, vi } from 'vitest';
import { initializeMetrics } from './metrics.js';
import { initializeTelemetry } from './telemetry.js';
import { trace } from '@opentelemetry/api';

it('exposes only approved aggregate samples and removes the listener on shutdown', async () => {
    const timings = channel('stamhoofd.database.duration');
    vi.stubEnv('STAM_METRICS_PORT', '');
    try {
        expect(initializeMetrics('api')).toBeUndefined();
        expect(timings.hasSubscribers).toBe(false);
        const socket = createServer().listen(0, '127.0.0.1');
        await once(socket, 'listening');
        const address = socket.address();
        if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
        await new Promise<void>((resolve) => socket.close(() => resolve()));
        vi.stubEnv('STAM_METRICS_PORT', String(address.port));
        vi.stubEnv('OTEL_SERVICE_NAME', 'api');
        vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '');
        vi.stubEnv('OTEL_EXPORTER_OTLP_LOGS_ENDPOINT', '');
        vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', '');
        const telemetry = initializeTelemetry('api');
        const url = `http://127.0.0.1:${address.port}/metrics`;
        try {
            expect(trace.getTracer('test').startSpan('test').isRecording()).toBe(false);
            timings.publish({ duration: 25, operation: 'acquire', outcome: 'success' });
            timings.publish({ duration: 5, operation: 'select', outcome: 'error', sql: 'private' });
            timings.publish({ duration: 50, operation: 'private', outcome: 'error' });
            const text = await (await fetch(url)).text();
            const sums = text.split('\n').filter((line) => line.includes('_sum{'));
            expect(sums).toHaveLength(2);
            expect(sums).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(
                        /^stamhoofd_db_acquire_duration_milliseconds_sum\{.*\} 25$/,
                    ),
                    expect.stringMatching(
                        /^stamhoofd_db_execute_duration_milliseconds_sum\{.*\} 5$/,
                    ),
                ]),
            );
            expect(text).toContain('service_name="api"');
            expect(text).toContain('operation="select"');
            expect(text).toContain('outcome="error"');
            expect(text).not.toContain('private');
        } finally {
            await telemetry.shutdown();
        }
        expect(timings.hasSubscribers).toBe(false);
        await expect(fetch(url)).rejects.toThrow();
    } finally {
        vi.unstubAllEnvs();
    }
});
