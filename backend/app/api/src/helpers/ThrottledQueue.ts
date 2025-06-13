/**
 * Define an expensive action that needs to run on a list of items.
 * Instead of running the action per item, it will call it on a batch of items or if a certain time has passed.
 *
 * Note that the handler can be called in parallel in some situations.
 */
export class ThrottledQueue<T> {
    items: Set<T> = new Set<T>();
    timeout: NodeJS.Timeout | null = null;

    maxBatchSize = 100;

    /**
     * The queue is cleared at least after this duration.
     * Set to null (default) to disable the timeout.
     * In milliseconds.
     */
    maxDelay: number | null = 10_000;

    handler: (items: T[]) => Promise<void> | void;
    emptyHandler?: () => void;

    constructor(handler: (items: T[]) => Promise<void> | void, options: { maxBatchSize?: number; maxDelay?: number | null; emptyHandler?: () => void } = {}) {
        this.handler = handler;
        this.maxBatchSize = options.maxBatchSize ?? 100;
        this.maxDelay = options.maxDelay ?? 10_000;
        this.emptyHandler = options.emptyHandler;
    }

    addItems(items: T[]): void {
        for (const item of items) {
            this.items.add(item);
        }

        if (this.items.size >= this.maxBatchSize) {
            this.flushAll();
            return;
        }
        this.startTimeout();
    }

    addItem(item: T): void {
        this.items.add(item);

        if (this.items.size >= this.maxBatchSize) {
            this.flushAll();
            return;
        }
        this.startTimeout();
    }

    stopTimeout() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }

    startTimeout() {
        if (this.timeout || this.maxDelay === null) {
            // Keep existing
            return;
        }

        this.timeout = setTimeout(() => {
            this.timeout = null;
            this.flushAll();
        }, this.maxDelay); // Adjust the timeout duration as needed
    }

    pendingFlushes: Set<Promise<void>> = new Set<Promise<void>>();

    private async process(items: T[]) {
        // Calculate an efficient batch size (not simply using maxBatchSize)
        const batchCount = Math.ceil(items.length / this.maxBatchSize);
        if (batchCount === 0) {
            return;
        }
        const batchSize = Math.ceil(items.length / batchCount);

        for (let i = 0; i < items.length; i += batchSize) {
            // Avoid cloning the array if the batch size is larger than the remaining items
            const batch = batchSize < items.length ? items.slice(i, i + batchSize) : items;
            try {
                await this.handler(batch);
            }
            catch (error) {
                console.error('Error processing batch in ThrottledQueue:', error);
            }
        }
    }

    processErrorHandler(error: Error) {
        console.error('Error in ThrottledQueue flush:', error);
    }

    /**
     * Flushes all items in the queue.
     * Items that are added while processing will not be processed automatically, but rather when the tiemout is reached or the maximum is reached.
     */
    flushAll() {
        if (this.items.size === 0) {
            // Nothing to flush or clear
            return;
        }

        // Move items, so we can continue adding items while we are processing
        const items = [...this.items];
        this.items.clear();

        const flush = this.process(items)
            .catch(this.processErrorHandler)
            .finally(() => {
                this.pendingFlushes.delete(flush);

                if (this.pendingFlushes.size === 0 && this.items.size === 0) {
                // Call empty handler to signal that the queue is empty
                    this.stopTimeout();

                    if (this.emptyHandler) {
                        this.emptyHandler();
                    }
                }
            });

        this.pendingFlushes.add(flush);
    }

    async wait() {
        if (this.pendingFlushes.size === 0) {
            return;
        }

        // Wait for all pending flushes to complete
        await Promise.all(this.pendingFlushes);
    }

    /**
     * Note: this won't wait on new items that are added while flushing.
     */
    async flushAndWait() {
        this.flushAll();
        await this.wait();
    }
}
