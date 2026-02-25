import { ThrottledQueue } from './ThrottledQueue.js';

/**
 * Items are added to the queue and filtered by a handler function.
 * Then they are throttled per filtered group.
 */
export class GroupedThrottledQueue<T> {
    queues: Map<string, ThrottledQueue<T>> = new Map();
    handler: (group: string, items: T[]) => Promise<void> | void;
    timeout: NodeJS.Timeout | null = null;

    /**
     * The queue is cleared at least after this duration.
     * Set to null (default) to disable the timeout.
     * In milliseconds.
     */
    maxDelay: number | null = 10_000;
    itemDelay: number | null = null;

    constructor(
        handler: (group: string, items: T[]) => Promise<void> | void,
        options: { maxDelay?: number | null; itemDelay?: number | null } = {},
    ) {
        this.handler = handler;
        this.maxDelay = options.maxDelay !== null ? (options.maxDelay ?? 10_000) : null;
        this.itemDelay = options.itemDelay ?? null;
    }

    addItems(group: string, items: T[]): void {
        const existingQueue = this.queues.get(group);
        if (existingQueue) {
            existingQueue.addItems(items);
            this.startTimeout();
            return;
        }
        const newQueue = new ThrottledQueue<T>(items => this.handler(group, items), {
            maxDelay: this.itemDelay,
            emptyHandler: () => {
                this.queues.delete(group);
            },
        });
        this.queues.set(group, newQueue);
        newQueue.addItems(items);
        this.startTimeout();
    }

    addItem(group: string, item: T): void {
        this.addItems(group, [item]);
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

    flushGroup(group: string): void {
        const queue = this.queues.get(group);
        if (queue) {
            queue.flushAll();
        }
    }

    flushAll(): void {
        for (const queue of this.queues.values()) {
            queue.flushAll();
        }
        this.stopTimeout();
    }

    async waitGroup(group: string) {
        const queue = this.queues.get(group);
        if (queue) {
            await queue.wait();
        }
    }

    async flushGroupAndWait(group: string) {
        const queue = this.queues.get(group);
        if (queue) {
            await queue.flushAndWait();
        }
    }

    async flushAndWait() {
        this.stopTimeout();
        for (const queue of this.queues.values()) {
            await queue.flushAndWait();
        }
    }

    async wait() {
        for (const queue of this.queues.values()) {
            await queue.wait();
        }
    }
}
