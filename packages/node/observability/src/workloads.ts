import type { Meter } from '@opentelemetry/api';

type Queue = 'in_process' | 'throttled_batch';
const attempt = ['success', 'error'] as const;
const gated = [...attempt, 'skipped'] as const;
const cancelable = [...gated, 'aborted'] as const;
const outcomes = {
    in_process: cancelable,
    throttled_batch: attempt,
    cron_dispatch: ['returned', 'error', 'skipped'],
    stats_cycle: gated,
    stats_incremental: attempt,
    stats_deletes: attempt,
    stats_settle: attempt,
    backup_full: gated,
    backup_binlogs: attempt,
    backup_clean: gated,
    ses_message: gated,
    invoice_create: gated,
    settlement_reconciliation: cancelable,
} as const;
type Job = keyof typeof outcomes;
type Outcome = (typeof outcomes)[Job][number];

const reporters = new Map<Job, { running: number }>();
const queues = new Map<Queue, { depth: number; pending: Set<{ since: number }> }>();

function instruments(meter: Meter) {
    return {
        outcomes: meter.createCounter('stamhoofd.worker.outcomes'),
        duration: meter.createHistogram('stamhoofd.worker.duration.milliseconds', {
            unit: 'ms',
            advice: {
                explicitBucketBoundaries: [
                    1, 10, 100, 1000, 10000, 60000, 300000, 1800000, 7200000,
                ],
            },
        }),
    };
}
let metrics: ReturnType<typeof instruments> | undefined;

function initializeOutcomes(worker: Job) {
    if (!metrics) return;
    for (const outcome of outcomes[worker]) metrics.outcomes.add(0, { worker, outcome });
}

/** Register once at the worker definition, never with a runtime queue key or message. */
export function defineWorker(job: Job) {
    const state = { running: 0 };
    reporters.set(job, state);
    initializeOutcomes(job);
    const start = () => {
        const sink = metrics;
        if (!sink) return;
        const since = performance.now();
        state.running++;
        return (outcome: Outcome) => {
            state.running--;
            sink.duration.record(performance.now() - since, { worker: job, outcome });
            sink.outcomes.add(1, { worker: job, outcome });
        };
    };
    return {
        start,
        skip(count = 1) {
            metrics?.outcomes.add(count, { worker: job, outcome: 'skipped' });
        },
        async run<T>(work: () => Promise<T> | T) {
            const finish = start();
            try {
                const result = await work();
                finish?.('success');
                return result;
            } catch (error) {
                finish?.('error');
                throw error;
            }
        },
    };
}

/** Pending tokens retain counts and monotonic timestamps, never the items or their owners. */
export function defineQueue(job: Queue) {
    const state = { depth: 0, pending: new Set<{ since: number }>() };
    queues.set(job, state);
    return {
        ...defineWorker(job),
        enqueue(count: number) {
            if (!metrics) return;
            const token = { since: performance.now() };
            state.pending.add(token);
            state.depth += count;
            return {
                get count() {
                    return count;
                },
                leave(size = count) {
                    state.depth -= size;
                    count -= size;
                    if (!count) state.pending.delete(token);
                },
            };
        },
    };
}

export function enableWorkMetrics(meter: Meter) {
    metrics = instruments(meter);
    for (const worker of reporters.keys()) initializeOutcomes(worker);
    const running = meter.createObservableGauge('stamhoofd.worker.running');
    const depth = meter.createObservableGauge('stamhoofd.queue.pending');
    const age = meter.createObservableGauge('stamhoofd.queue.oldest_pending.milliseconds', {
        unit: 'ms',
    });
    meter.addBatchObservableCallback(
        (result) => {
            for (const [worker, state] of reporters)
                result.observe(running, state.running, { worker });
            for (const [worker, state] of queues) {
                const oldest = state.pending.values().next().value;
                result.observe(depth, state.depth, { worker });
                result.observe(age, oldest ? performance.now() - oldest.since : 0, { worker });
            }
        },
        [running, depth, age],
    );
}

export function disableWorkMetrics() {
    metrics = undefined;
}
