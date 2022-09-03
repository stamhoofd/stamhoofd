
class Queue {
    name: string
    items: QueueItem<any>[] = []
    parallel = 1
    runCount = 0

    constructor(name: string, parallel = 1) {
        this.name = name
        this.parallel = parallel
    }

    addItem(item: QueueItem<any>) {
        this.items.push(item)
    }
}

class QueueItem<T> {
    handler: () => Promise<T>
    resolve: (value: T) => void
    reject: (reason?: any) => void
}

/**
 * Force the usage of a queue to prevent concurrency issues
 */
export class QueueHandler {
    static queues = new Map<string, Queue>()

    static async schedule<T>(queue: string, handler: () => Promise<T>, parallel = 1): Promise<T> {
        console.log("[QUEUE] Schedule "+queue)

        const item = new QueueItem<T>()
        item.handler = handler
        
        const promise = new Promise<T>((resolve, reject) => {
            item.resolve = resolve
            item.reject = reject

            // We only add it here because resolve and reject is required
            const q = this.queues.get(queue) ?? new Queue(queue, parallel)
            q.addItem(item)
            this.queues.set(queue, q)

            // Run the next item if not already running
            this.runNext(queue).catch(e => {
                console.error("[QUEUE] Fatal error in queue logic", e)
            })
        })

        return promise
    }

    private static async runNext(queue: string) {
        const q = this.queues.get(queue)
        if (!q) {
            console.warn("[QUEUE] Queue not found (no items left)", queue)
            return
        }

        if (q.runCount >= q.parallel) {
            console.log("[QUEUE] Queue", queue, 'reached maximum of', q.parallel)
            return
        }

        const next = q.items.shift()

        if (next === undefined) {
            this.queues.delete(queue)
            return
        }

        q.runCount += 1
        console.log("[QUEUE] ("+q.runCount+"/"+q.parallel+") Executing "+queue+" ("+q.items.length+" remaining)")

        try {
            const result = await next.handler()
            next.resolve(result)
            console.log("[QUEUE] ("+(q.runCount-1)+"/"+q.parallel+") Resolved "+queue+" ("+q.items.length+" remaining)")
        } catch (e) {
            next.reject(e)
            console.log("[QUEUE] ("+(q.runCount-1)+"/"+q.parallel+") Rejected "+queue+" ("+q.items.length+" remaining)")
            console.error(e)
        }

        q.runCount -= 1
        await this.runNext(queue)
    }
}