import { isReactive, markRaw } from 'vue';

type Listener<E, Value> = (value: Value, type: E) => Promise<void> | void;

/**
 * Controls the fetching and decrypting of members
 */
export class EventBus<E, Value> {
    protected listeners: Map<any, { type: E; listener: Listener<E, Value> }[]> = markRaw(new Map());

    addListener<T extends E>(owner: any, type: T, listener: Listener<E, Value>) {
        if (isReactive(owner)) {
            console.warn('Adding a listener with a proxy object. This is not recommended and can cause bugs.');
        }

        const existing = this.listeners.get(owner);
        if (existing) {
            existing.push({ type, listener });
        }
        else {
            this.listeners.set(owner, [{ type, listener }]);
        }
    }

    removeListener(owner: any) {
        if (isReactive(owner)) {
            console.warn('Removing a listener with a proxy object. This is not recommended and can cause bugs.');
        }

        this.listeners.delete(owner);
    }

    async sendEvent(type: E, value: Value) {
        const values: (Promise<any> | undefined)[] = [];
        for (const owner of this.listeners.values()) {
            for (const listener of owner) {
                if (listener.type === type) {
                    values.push(listener.listener(value, type) ?? undefined);
                }
            }
        }
        return await Promise.all(values);
    }
}

export const GlobalEventBus = new EventBus<string | symbol, any>();
