import type { Meter } from '@opentelemetry/api';

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

/** Register once at the worker definition, never with a runtime queue key or message. */
export class WorkerMetrics {
    private static readonly workers = new Map<Job, WorkerMetrics>();
    private static metrics?: ReturnType<typeof instruments>;
    private running = 0;

    constructor(private readonly job: Job) {
        WorkerMetrics.workers.set(job, this);
        this.initializeOutcomes();
    }

    static enable(meter: Meter) {
        WorkerMetrics.metrics = instruments(meter);
        for (const worker of WorkerMetrics.workers.values()) worker.initializeOutcomes();
        meter.createObservableGauge('stamhoofd.worker.running').addCallback((result) => {
            for (const [worker, reporter] of WorkerMetrics.workers) {
                result.observe(reporter.running, { worker });
            }
        });
    }

    static disable() {
        WorkerMetrics.metrics = undefined;
    }

    private initializeOutcomes() {
        for (const outcome of outcomes[this.job]) {
            WorkerMetrics.metrics?.outcomes.add(0, { worker: this.job, outcome });
        }
    }

    start() {
        const sink = WorkerMetrics.metrics;
        if (!sink) return;
        const since = performance.now();
        this.running++;
        return (outcome: Outcome) => {
            this.running--;
            sink.duration.record(performance.now() - since, { worker: this.job, outcome });
            sink.outcomes.add(1, { worker: this.job, outcome });
        };
    }

    skip(count = 1) {
        WorkerMetrics.metrics?.outcomes.add(count, { worker: this.job, outcome: 'skipped' });
    }

    async run<T>(work: () => Promise<T> | T) {
        const finish = this.start();
        try {
            const result = await work();
            finish?.('success');
            return result;
        } catch (error) {
            finish?.('error');
            throw error;
        }
    }
}
