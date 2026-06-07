import { Database } from '@simonbackx/simple-database';
import type { SQLSelect } from '@stamhoofd/sql';
import type { ProgressLogger } from '@stamhoofd/utility';
import { LoggingTools } from '@stamhoofd/utility';

/**
 * If an error is thrown, first await all pending items before throwing, otherwise we risk quiting mid running actions
 */
export function allSettledButThrowFirst<T>(promises: Promise<T>[]): Promise<T[]> {
    return Promise.allSettled(promises).then((results) => {
        return results.map((r) => {
            if (r.status === 'fulfilled') {
                return r.value;
            }
            throw r.reason;
        });
    });
}

export class SeedTools {
    static createBatchProcessor<T>(options: BatchProcessorArgs<T>) {
        return new BatchProcessor(options);
    }

    static async loop<T extends { id: string }>(options: BatchProcessorArgs<T> & { query: SQLSelect<T> }) {
        const batchProcessor = SeedTools.createBatchProcessor(options);

        const progressLogger = await LoggingTools.createProgressLoggerFromQuery(options.query.clone());
        batchProcessor.setProgressLogger(progressLogger);

        for await (const item of options.query.limit(options.batchSize).all()) {
            await batchProcessor.execute(item as T);
        }
        await batchProcessor.finish();

        return {
            total: progressLogger.total,
        };
    }

    static async loopBatched<T extends { id: string }>(options: { batchSize: number; batchAction: (items: T[]) => Promise<void>; query: SQLSelect<T> }) {
        const progressLogger = await LoggingTools.createProgressLoggerFromQuery(options.query.clone());

        for await (const batch of options.query.limit(options.batchSize).allBatched()) {
            await options.batchAction(batch as T[]);
            progressLogger.update(batch.length);
        }

        return {
            total: progressLogger.total,
        };
    }
}

type BatchProcessorArgs<T> = {
    batchSize: number;
    useTransactionPerBatch?: boolean;
    action: (item: T) => Promise<void>;
};

class BatchProcessor<T> {
    private currentBatch: Promise<void>[] = [];
    private readonly batchSize: number;
    private readonly originalAction: (item: T) => Promise<void>;
    private action: (item: T) => Promise<void>;
    private readonly useTransactionPerBatch: boolean;

    constructor({ batchSize, action, useTransactionPerBatch }: BatchProcessorArgs<T>) {
        this.batchSize = batchSize;
        this.originalAction = action;
        this.action = action;
        this.useTransactionPerBatch = useTransactionPerBatch ?? false;
    }

    setProgressLogger(progressLogger: ProgressLogger) {
        this.action = async (item: T) => {
            await this.originalAction(item);
            progressLogger.update();
        };
    }

    async execute(item: T): Promise<void> {
        if (this.currentBatch.length === this.batchSize) {
            await this.finishCurrentBatch();
        }

        if (this.currentBatch.length < this.batchSize) {
            this.currentBatch.push(this.action(item));
        }
    }

    private async finishCurrentBatch() {
        if (this.useTransactionPerBatch) {
            await Database.beginTransaction(async () => {
                await allSettledButThrowFirst(this.currentBatch);
            });
        } else {
            await allSettledButThrowFirst(this.currentBatch);
        }
        this.currentBatch = [];
    }

    async finish(): Promise<void> {
        await this.finishCurrentBatch();
    }
}
