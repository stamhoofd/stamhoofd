
type Listener<E, Value> = (value: Value, type: E) => Promise<void>

/**
 * Controls the fetching and decrypting of members
 */
export class EventBus<E, Value> {
    protected listeners: Map<any, { type: E; listener: Listener<E, Value> }[]> = new Map()

    addListener<T extends E>(owner: any, type: T, listener: Listener<T, Value>) {
        const existing = this.listeners.get(owner)
        if (existing) {
            existing.push({ type, listener })
        } else {
            this.listeners.set(owner, [{ type, listener}])
        }
    }

    removeListener(owner: any) {
        this.listeners.delete(owner)
    }

    async sendEvent(type: E, value: Value) {
        const values: Promise<any>[] = []
        for (const owner of this.listeners.values()) {
            for (const listener of owner) {
                if (listener.type == type) {
                    values.push(listener.listener(value, type))
                }
            }
            
        }
        return await Promise.all(values)
    }
}

export const GlobalEventBus = new EventBus<string, any>()