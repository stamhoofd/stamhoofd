
type Listener<E, Value> = (value: Value, type: E) => Promise<void>

/**
 * Controls the fetching and decrypting of members
 */
export class EventBus<E, Value> {
    protected listeners: Map<any, { type: E; listener: Listener<E, Value> }> = new Map()

    addListener<T extends E>(owner: any, type: T, listener: Listener<T, Value>) {
        this.listeners.set(owner, { type, listener})
    }

    removeListener(owner: any) {
        this.listeners.delete(owner)
    }

    async sendEvent(type: E, value: Value) {
        for (const listener of this.listeners.values()) {
            if (listener.type == type) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                await listener.listener(value, type)
            }
        }
    }
}

export const GlobalEventBus = new EventBus<string, any>()