
class Queue {
    name: string
    items: QueueItem<any>[] = []
    running = false

    constructor(name: string) {
        this.name = name
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

    static async schedule<T>(queue: string, handler: () => Promise<T>): Promise<T> {
        //console.log("[QUEUE] Schedule "+queue)

        const item = new QueueItem<T>()
        item.handler = handler
        
        const promise = new Promise<T>((resolve, reject) => {
            item.resolve = resolve
            item.reject = reject

            // We only add it here because resolve and reject is required
            const q = this.queues.get(queue) ?? new Queue(queue)
            q.addItem(item)
            this.queues.set(queue, q)

            // Run the next item if not already running
            this.runNext(queue).catch(e => {
                console.log("Fatal error in queue logic")
                console.error(e)
            })
        })

        return promise
    }

    private static async runNext(queue: string) {
        const q = this.queues.get(queue)
        if (!q) {
            console.warn("Queue not found")
            return
        }

        if (q.running) {
            console.log("Queue already running")
            return
        }

        const next = q.items.shift()

        if (next === undefined) {
            this.queues.delete(queue)
            return
        }

        q.running = true
        console.log("[QUEUE] Executing "+queue+" ("+q.items.length+" remaining)")

        try {
            const result = await next.handler()
            next.resolve(result)
            console.log("[QUEUE] Resolved "+queue+" ("+q.items.length+" remaining)")
        } catch (e) {
            next.reject(e)
            console.log("[QUEUE] Rejected "+queue+" ("+q.items.length+" remaining)")
            console.error(e)
        }

        q.running = false
        await this.runNext(queue)
    }
}