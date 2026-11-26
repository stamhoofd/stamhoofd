import { initializeTelemetry, traceEndpoint } from '@node/observability';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { QueueHandler } from '@stamhoofd/queues';

it('classifies a cooperative abort but preserves an unrelated failure after abort', async () => {
    const records = new InMemorySpanExporter();
    const runtime = initializeTelemetry('api', {
        ownsMetrics: false,
        localProcessor: new SimpleSpanProcessor({ exporter: records }),
    });
    try {
        await traceEndpoint({}, 'POST', async () => {
            for (const cooperative of [true, false]) {
                const cancellation = Error('cancel'),
                    other = Error('another');
                await expect(
                    QueueHandler.schedule('private', async ({ abort }) => {
                        QueueHandler.abort('private', cancellation);
                        if (cooperative) abort.throwIfAborted();
                        throw other;
                    }),
                ).rejects.toBe(cooperative ? cancellation : other);
            }
            return { status: 200 };
        });
        expect(
            records
                .getFinishedSpans()
                .filter((s) => s.name === 'queue.execute')
                .map((s) => s.attributes['error.type']),
        ).toEqual(['cancelled', 'execution']);
    } finally {
        await runtime.shutdown();
    }
});
