import { DatabaseInstance } from '@node/database';
import { initializeTelemetry, traceEndpoint } from '@node/observability';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { QueueHandler } from '@stamhoofd/queues';

it('attributes contended queue execution and transactional SQL to their submitter', async () => {
    const records = new InMemorySpanExporter();
    const runtime = initializeTelemetry('api', {
        ownsMetrics: false,
        localProcessor: new SimpleSpanProcessor({ exporter: records }),
    });
    const db = DatabaseInstance.current;
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
        release = resolve;
    });
    const first = traceEndpoint({}, 'GET', async () => {
        await Promise.all(
            ['private-A', 'private-B'].map((key) => QueueHandler.schedule(key, () => blocked)),
        );
        return { status: 200 };
    });
    try {
        await traceEndpoint({}, 'POST', async () => {
            const pending = QueueHandler.schedule('private-A', () =>
                QueueHandler.schedule('private-A', async () => {
                    await db.beginTransaction(async () => {
                        await db.select('SELECT 1');
                        await db.select('SELECT 2');
                    });
                    throw Error('private-work');
                }),
            );
            const cancelled = QueueHandler.schedule('private-B', async () => {
                throw Error('must not run');
            });
            QueueHandler.cancel('private-B', Error('private-cancellation'));
            release();
            await Promise.all([
                expect(pending).rejects.toThrow('private-work'),
                expect(cancelled).rejects.toThrow('private-cancellation'),
            ]);
            return { status: 200 };
        });
        await first;
        const spans = records.getFinishedSpans();
        const roots = spans.filter((s) => !s.parentSpanContext);
        expect(roots).toHaveLength(2);
        for (const root of roots) {
            const group = spans.filter(
                (s) => s.spanContext().traceId === root.spanContext().traceId,
            );
            const waits = group.filter((s) => s.name === 'queue.wait');
            const runs = group.filter((s) => s.name === 'queue.execute');
            expect(waits).toHaveLength(2);
            expect(
                [...waits, ...runs].every(
                    (s) => s.parentSpanContext?.spanId === root.spanContext().spanId,
                ),
            ).toBe(true);
            if (root.attributes['http.request.method'] === 'POST') {
                expect(runs).toHaveLength(1);
                expect(runs[0].attributes['error.type']).toBe('execution');
                expect(waits.some((s) => s.attributes['error.type'] === 'cancelled')).toBe(true);
                const sql = group.filter((s) => s.name.startsWith('mysql.'));
                expect(sql.map((s) => s.name)).toEqual([
                    'mysql.acquire',
                    'mysql.execute',
                    'mysql.execute',
                ]);
                expect(
                    sql.every((s) => s.parentSpanContext?.spanId === runs[0].spanContext().spanId),
                ).toBe(true);
            } else expect(runs).toHaveLength(2);
        }
    } finally {
        release();
        await first;
        await runtime.shutdown();
    }
});
