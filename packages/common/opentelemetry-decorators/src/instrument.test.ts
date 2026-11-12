import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { instrument, withSpan, log, withLogSink } from './instrument.js';

const exporter = new InMemorySpanExporter();
const sdk = new NodeSDK({
    autoDetectResources: false,
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
});
beforeAll(() => sdk.start());
beforeEach(() => exporter.reset());
afterAll(() => sdk.shutdown());

it('preserves results and application errors when a diagnostic sink throws', async () => {
    const sink = () => {
        throw new Error('sink unavailable');
    };
    expect(
        withLogSink(sink, () => {
            log('info', 'hello');
            return 42;
        }),
    ).toBe(42);
    const error = new Error('application failure');
    await expect(
        withLogSink(sink, () =>
            withSpan('failed', async () => {
                log('error', 'diagnostic');
                throw error;
            }),
        ),
    ).rejects.toBe(error);
});

it('preserves synchronous method results and this with a decorator', () => {
    class Counter {
        value = 2;
        @instrument('counter.add', { fields: ([amount]: [number]) => ({ amount }) })
        add(amount: number) {
            return this.value + amount;
        }
    }
    expect(new Counter().add(3)).toBe(5);
    expect(exporter.getFinishedSpans()[0].attributes).toEqual({ amount: 3 });
});

it('inherits fields and parentage across awaits without mixing parallel operations', async () => {
    const records: Record<string, unknown>[] = [];
    const child = instrument('child', async () => {
        await Promise.resolve();
        log('info', 'child');
    });
    const parent = instrument(
        'parent',
        async (environment: string) => {
            await Promise.resolve();
            await child();
            return environment;
        },
        { fields: ([environment]) => ({ environment }) },
    );
    const result = await withLogSink(
        (_level, message, fields) => {
            if (message === 'child') records.push(fields);
        },
        () => Promise.all([parent('staging'), parent('production')]),
    );
    expect(result).toEqual(['staging', 'production']);
    expect(records.map((record) => record.environment).sort()).toEqual(['production', 'staging']);
    const spans = exporter.getFinishedSpans();
    for (const span of spans.filter((span) => span.name === 'child')) {
        const parentSpan = spans.find(
            (candidate) => candidate.spanContext().spanId === span.parentSpanContext?.spanId,
        );
        expect(parentSpan?.attributes).toEqual(span.attributes);
        expect(
            records.find((record) => record.span_id === span.spanContext().spanId)?.trace_id,
        ).toBe(span.spanContext().traceId);
    }
});

it('ends failed spans and preserves errors without recording their secret-bearing messages', async () => {
    const error = new Error('secret-token');
    const failed = instrument('failure', async () => {
        throw error;
    });
    await expect(failed()).rejects.toBe(error);
    const span = exporter.getFinishedSpans()[0];
    expect(span.status.code).toBe(2);
    expect(span.events).toEqual([]);
    expect(span.status.message).toBeUndefined();
});
