import { isSimpleError, SimpleError } from '@simonbackx/simple-errors';
import { AsyncLocalStorage } from 'node:async_hooks';

class Queue {
    name: string;
    items: QueueItem<any>[] = [];
    parallel = 1;
    runCount = 0;
    abortSignals: Set<AbortSignal> = new Set();

    constructor(name: string, parallel = 1) {
        this.name = name;
        this.parallel = parallel;
    }

    addItem(item: QueueItem<any>) {
        this.items.push(item);
    }

    createAbortSignal() {
        const signal = new AbortSignal();
        this.abortSignals.add(signal);
        return signal;
    }

    removeAbortSignal(signal: AbortSignal) {
        this.abortSignals.delete(signal);
    }

    abort(error?: Error) {
        for (const signal of this.abortSignals) {
            signal.abort(error);
        }
        this.abortSignals.clear(); // Avoid swapping error midway the abort
    }
}

export type QueueHandlerOptions = {
    abort: AbortSignal;
};

class QueueItem<T> {
    handler: (options: QueueHandlerOptions) => Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
}

export function isDebouncedError(error: unknown) {
    return isSimpleError(error) && error.code === 'queue-debounced';
}

export function isCanceledError(error: unknown) {
    return isSimpleError(error) && error.code === 'queue-canceled';
}

export function isAbortedError(error: unknown) {
    return isSimpleError(error) && error.code === 'queue-aborted';
}

export class AbortSignal {
    protected abortWithError: unknown | null = null;
    protected listeners: ((error: unknown) => Promise<void> | void)[] = [];

    get isAborted() {
        return this.abortWithError !== null;
    }

    abort(error?: unknown) {
        if (this.isAborted) {
            return;
        }
        this.abortWithError = error ?? new SimpleError({
            code: 'queue-aborted',
            message: 'Queue was aborted',
            statusCode: 500,
        });

        for (const listener of this.listeners) {
            const promise = listener(this.abortWithError);
            if (promise instanceof Promise) {
                promise.catch((e) => {
                    console.error('Error in abort listener', e);
                });
            }
        }
        this.listeners = [];
    }

    throwIfAborted(cleanup: () => Promise<void>): Promise<void>;
    throwIfAborted(cleanup?: () => void): void;
    throwIfAborted(cleanup?: () => Promise<void> | void): Promise<void> | void {
        if (this.isAborted) {
            if (cleanup) {
                const promise = cleanup();
                if (promise instanceof Promise) {
                    return promise.then(() => {
                        throw this.abortWithError;
                    });
                }
            }
            throw this.abortWithError;
        }
    }

    // Add event listeners
    on(on: 'abort', listener: (error: unknown) => Promise<void> | void) {
        this.listeners.push(listener);
    }
}

/**
 * Force the usage of a queue to prevent concurrency issues
 */
export class QueueHandler {
    static queues = new Map<string, Queue>();
    static asyncLocalStorage = new AsyncLocalStorage<string[]>();

    static cancel(queue: string, error?: Error) {
        const q = this.queues.get(queue);
        if (q) {
            // This doesn't interfere any running items
            for (const item of q.items) {
                item.handler = () => {
                    return Promise.reject(error ?? new SimpleError({
                        code: 'queue-canceled',
                        message: 'Queue ' + queue + ' was canceled',
                    }));
                };
            }
        }
    }

    /**
     * Abort any running queue items. Same as 'cancel' but will also reject any running items if they support the 'abort' method (otherwise they will just resolve as normal)
     */
    static abort(queue: string, error?: Error) {
        const q = this.queues.get(queue);
        if (q) {
            // This doesn't interfere any running items
            for (const item of q.items) {
                item.handler = () => {
                    return Promise.reject(error ?? new SimpleError({
                        code: 'queue-canceled',
                        message: 'Queue ' + queue + ' was canceled',
                    }));
                };
            }

            q.abort(error);
        }
    }

    static abortAll(error?: Error) {
        for (const queueName of this.queues.keys()) {
            this.abort(queueName, error);
        }
    }

    /** $
     * Waits {timeout} ms before executing the handler, if another call is made to the same queue, the timeout is reset
     * and the other users will receive an error.
     *
     * Note: this will throw if the handler was debounced and not yet executed
     */
    static async debounce<T>(queue: string, handler: (options: QueueHandlerOptions) => Promise<T>, timeout: number): Promise<T> {
        // Stop any running items that were not yet executed
        this.abort(queue, new SimpleError({
            code: 'queue-debounced',
            message: 'Debounced',
            statusCode: 500,
        }));

        // Schedule timeout (will throw if cancelled)
        await this.schedule(queue, ({ abort }) => {
            return new Promise<void>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    resolve();
                }, timeout);

                abort.on('abort', (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
            });
        });

        // Run the handler
        return await this.schedule(queue, handler);
    }

    static async schedule<T>(queue: string, handler: (options: QueueHandlerOptions) => Promise<T>, parallel = 1): Promise<T> {
        // console.log("[QUEUE] Schedule "+queue)

        const currentQueues = this.asyncLocalStorage.getStore();
        if (currentQueues !== undefined && currentQueues.includes(queue)) {
            // Recursive usage of queues detected. Ignored running in queue
            return await handler({ abort: new AbortSignal() });
        }

        // We need to save the current AsyncLocalStorage context
        // otherwise we could run items on the queue with the wrong context
        const snapshot = AsyncLocalStorage.snapshot();

        const item = new QueueItem<T>();
        item.handler = options => snapshot(async () => {
            const currentQueues = this.asyncLocalStorage.getStore() ?? [];
            return await this.asyncLocalStorage.run([...currentQueues, queue], async () => {
                return await handler(options);
            });
        });

        const promise = new Promise<T>((resolve, reject) => {
            item.resolve = resolve;
            item.reject = reject;

            // We only add it here because resolve and reject is required
            const q = this.queues.get(queue) ?? new Queue(queue, parallel);
            q.addItem(item);
            this.queues.set(queue, q);

            // Run the next item if not already running
            this.runNext(queue).catch((e) => {
                console.error('[QUEUE] Fatal error in queue logic', e);
            });
        });

        return promise;
    }

    static isRunning(queue: string) {
        return this.getSize(queue) > 0;
    }

    /**
     * Returns amount of running jobs + pending jobs for a given queue
     */
    static getSize(queue: string) {
        const q = this.queues.get(queue);
        return q ? (q.runCount + q.items.length) : 0;
    }

    static async awaitAll(): Promise<void> {
        for (const queue of this.queues.keys()) {
            if (this.getSize(queue) > 0) {
                let didResolve = false;
                let timeout: NodeJS.Timeout | undefined;
                if (STAMHOOFD.environment !== 'production') {
                    timeout = setTimeout(() => {
                        if (!didResolve) {
                            console.warn('[QUEUE] Still waiting for queue', queue, 'to finish. This might indicate a deadlock or a long-running task.');
                        }
                    }, 2000);
                }
                await this.schedule(queue, async () => {});
                didResolve = true;
                if (timeout) {
                    clearTimeout(timeout);
                }
            }
        }
    }

    private static async runNext(queue: string) {
        const q = this.queues.get(queue);
        if (!q) {
            // console.warn("[QUEUE] Queue not found (no items left)", queue)
            return;
        }

        if (q.runCount >= q.parallel) {
            //  console.log("[QUEUE] Queue", queue, 'reached maximum of', q.parallel)
            return;
        }

        const next = q.items.shift();

        if (next === undefined) {
            this.queues.delete(queue);
            return;
        }

        q.runCount += 1;
        // console.log("[QUEUE] ("+q.runCount+"/"+q.parallel+") Executing "+queue+" ("+q.items.length+" remaining)")
        const abort = q.createAbortSignal();

        try {
            next.resolve(await next.handler({
                abort,
            }));
            // console.log("[QUEUE] ("+(q.runCount-1)+"/"+q.parallel+") Resolved "+queue+" ("+q.items.length+" remaining)")
        }
        catch (e) {
            next.reject(e);
            if (!isDebouncedError(e) && !isCanceledError(e) && !isAbortedError(e)) {
                console.log('[QUEUE] (' + (q.runCount - 1) + '/' + q.parallel + ') Rejected ' + queue + ' (' + q.items.length + ' remaining)');
                console.error(e);
            }
            else {
                if (isDebouncedError(e)) {
                    console.log('[QUEUE] (' + (q.runCount - 1) + '/' + q.parallel + ') Debounced ' + queue + ' (' + q.items.length + ' remaining)');
                }
                else if (isCanceledError(e)) {
                    console.log('[QUEUE] (' + (q.runCount - 1) + '/' + q.parallel + ') Canceled ' + queue + ' (' + q.items.length + ' remaining)');
                }
                else if (isAbortedError(e)) {
                    console.log('[QUEUE] (' + (q.runCount - 1) + '/' + q.parallel + ') Aborted ' + queue + ' (' + q.items.length + ' remaining)');
                }
            }
        }
        finally {
            q.removeAbortSignal(abort);
        }

        q.runCount -= 1;
        await this.runNext(queue);
    }
}
