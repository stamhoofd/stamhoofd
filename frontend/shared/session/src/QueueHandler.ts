import { SimpleError } from '@simonbackx/simple-errors';

/**
 * This is almost identical than the backend QueueHandler, except that it does not automatically detect
 * nested queues (no async contexts in the browser at the moment), and can cause deadlocks if not used properly.
 *
 * Because of that important difference (which is very important in the backend), we cannot share the code.
 */

class Queue {
    name: string;
    items: QueueItem<any>[] = [];
    parallel = 1;
    runCount = 0;

    constructor(name: string, parallel = 1) {
        this.name = name;
        this.parallel = parallel;
    }

    addItem(item: QueueItem<any>) {
        this.items.push(item);
    }
}

export type QueueHandlerOptions = Record<string, never>;

class QueueItem<T> {
    handler: (options: QueueHandlerOptions) => Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
}

/**
 * Force the usage of a queue to prevent concurrency issues
 */
export class QueueHandler {
    static queues = new Map<string, Queue>();

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

    static async schedule<T>(queue: string, handler: (options: QueueHandlerOptions) => Promise<T>, parallel = 1): Promise<T> {
        const item = new QueueItem<T>();
        item.handler = handler;

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

        try {
            next.resolve(await next.handler({}));
            // console.log("[QUEUE] ("+(q.runCount-1)+"/"+q.parallel+") Resolved "+queue+" ("+q.items.length+" remaining)")
        }
        catch (e) {
            next.reject(e);
            console.log('[QUEUE] (' + (q.runCount - 1) + '/' + q.parallel + ') Rejected ' + queue + ' (' + q.items.length + ' remaining)');
            console.error(e);
        }

        q.runCount -= 1;
        await this.runNext(queue);
    }
}
