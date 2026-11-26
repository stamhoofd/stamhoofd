import type { Meter } from '@opentelemetry/api';
import { WorkerMetrics } from './WorkerMetrics.js';

type Queue = 'in_process' | 'throttled_batch';

export interface PendingQueueItems {
    readonly count: number;
    /** Remove the given number of items, or all remaining items by default. */
    removeFromPending(size?: number): void;
}

export class QueueMetrics extends WorkerMetrics {
    private static readonly queues = new Map<Queue, QueueMetrics>();
    private static enabled = false;
    private readonly pending = new Set<{ since: number }>();
    private depth = 0;

    constructor(queue: Queue) {
        super(queue);
        QueueMetrics.queues.set(queue, this);
    }

    static override enable(meter: Meter) {
        QueueMetrics.enabled = true;
        const depth = meter.createObservableGauge('stamhoofd.queue.pending');
        const age = meter.createObservableGauge('stamhoofd.queue.oldest_pending.milliseconds', {
            unit: 'ms',
        });
        meter.addBatchObservableCallback(
            (result) => {
                for (const [worker, queue] of QueueMetrics.queues) {
                    const oldest = queue.pending.values().next().value;
                    result.observe(depth, queue.depth, { worker });
                    result.observe(age, oldest ? performance.now() - oldest.since : 0, { worker });
                }
            },
            [depth, age],
        );
    }

    static override disable() {
        QueueMetrics.enabled = false;
    }

    /** Track a group by arrival time without retaining the queued items. */
    trackPending(count: number): PendingQueueItems | undefined {
        if (!QueueMetrics.enabled) return;
        const token = { since: performance.now() };
        this.pending.add(token);
        this.depth += count;
        return {
            get count() {
                return count;
            },
            removeFromPending: (size = count) => {
                this.depth -= size;
                count -= size;
                if (!count) this.pending.delete(token);
            },
        };
    }
}
