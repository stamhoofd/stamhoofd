import { trace } from '@opentelemetry/api';
import {
    InMemorySpanExporter,
    SimpleSpanProcessor,
    TracerProvider,
} from '@opentelemetry/sdk-trace';
import { channel } from 'node:diagnostics_channel';
import { expect, it } from 'vitest';
import {
    enableBackendTraces,
    traceEndpoint,
    traceVerifiedRender,
    traceStatisticsCycle,
} from './backend-traces.js';

it('bounds SQL children of a statistics cycle and stops recording detached work', async () => {
    const records = new InMemorySpanExporter();
    const provider = new TracerProvider({
        spanProcessors: [new SimpleSpanProcessor({ exporter: records })],
    });
    trace.setGlobalTracerProvider(provider);
    const stop = enableBackendTraces('stats');
    const timings = channel('stamhoofd.database.duration');
    const publish = () =>
        timings.publish({ operation: 'select', duration: 1, outcome: 'error', sql: 'canary' });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
        release = resolve;
    });
    let detached: Promise<void> | undefined;
    try {
        await traceStatisticsCycle(() => {
            detached = pending.then(publish);
            for (let i = 0; i < 100; i++) publish();
            return Promise.resolve();
        });
        release();
        await detached;
        await provider.forceFlush();
        const spans = records.getFinishedSpans();
        const root = spans.find((s) => s.name === 'statistics.cycle')!;
        const children = spans.filter((s) => s.name === 'mysql.execute');
        expect(children).toHaveLength(24);
        for (const child of children) {
            expect(child.parentSpanContext?.spanId).toBe(root.spanContext().spanId);
            expect(child.attributes).toEqual({
                'db.operation.name': 'select',
                'error.type': 'execution',
            });
            expect(child.status).toEqual({ code: 2 });
        }
    } finally {
        stop?.();
        trace.disable();
        await provider.shutdown();
    }
});

it('reserves renderer capacity for verified sampled parents after public roots exhaust their budget', async () => {
    const records = new InMemorySpanExporter();
    const provider = new TracerProvider({
        spanProcessors: [new SimpleSpanProcessor({ exporter: records })],
    });
    trace.setGlobalTracerProvider(provider);
    const stop = enableBackendTraces('renderer');
    try {
        const work = async () => ({ status: 200 });
        for (let i = 0; i < 3; i++) await traceEndpoint({}, 'GET', work);
        const context = `00-${'a'.repeat(32)}-${'b'.repeat(16)}-`;
        await traceVerifiedRender(context + '00', work);
        await traceVerifiedRender(context + '01', work);
        await provider.forceFlush();
        expect(
            records
                .getFinishedSpans()
                .filter((s) => s.parentSpanContext)
                .map((s) => s.parentSpanContext?.spanId),
        ).toEqual(['b'.repeat(16)]);
    } finally {
        stop?.();
        trace.disable();
        await provider.shutdown();
    }
});
