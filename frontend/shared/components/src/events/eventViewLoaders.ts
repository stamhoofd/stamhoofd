import type { Component, InjectionKey } from 'vue';
import { inject, provide } from 'vue';

export type EventViewLoaders = {
    overview: () => Promise<{ default: Component }>;
    notification: () => Promise<{ default: Component }>;
};

export const eventViewLoadersKey: InjectionKey<EventViewLoaders> = Symbol('eventViewLoaders');

export function useProvideEventViewLoaders(value: EventViewLoaders) {
    provide(eventViewLoadersKey, value);
}

export function useEventViewLoaders(): EventViewLoaders {
    const loaders = inject(eventViewLoadersKey, null);
    if (!loaders) {
        throw new Error('Event view loaders have not been provided');
    }
    return loaders;
}
