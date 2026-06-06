import type { ProgressLogger } from '@stamhoofd/utility';

export class SeedTools {
    static createBatchProcessor<T>(options: BatchProcessorArgs<T>) {
        return new BatchProcessor(options);
    }
}

type BatchProcessorArgs<T> = {
    batchSize: number;
    action: (item: T) => Promise<void>;
};

class BatchProcessor<T> {
    private currentBatch: Promise<void>[] = [];
    private readonly batchSize: number;
    private readonly originalAction: (item: T) => Promise<void>;
    private action: (item: T) => Promise<void>;

    constructor({ batchSize, action }: BatchProcessorArgs<T>) {
        this.batchSize = batchSize;
        this.originalAction = action;
        this.action = action;
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
        await Promise.all(this.currentBatch);
        this.currentBatch = [];
    }

    async finish(): Promise<void> {
        await this.finishCurrentBatch();
    }
}
