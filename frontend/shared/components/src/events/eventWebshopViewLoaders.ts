import type { Component, InjectionKey } from 'vue';
import { inject, provide } from 'vue';

export interface EventWebshopViewLoaders {
    overview: () => Promise<Component>;
    edit: () => Promise<{ default: Component }>;
}

export const eventWebshopViewLoadersKey: InjectionKey<EventWebshopViewLoaders> = Symbol('eventWebshopViewLoaders');

export function useProvideEventWebshopViewLoaders(value: EventWebshopViewLoaders) {
    provide(eventWebshopViewLoadersKey, value);
}

export function useEventWebshopViewLoaders(): EventWebshopViewLoaders {
    const loaders = inject(eventWebshopViewLoadersKey, null);
    if (!loaders) {
        throw new Error('Event webshop view loaders have not been provided');
    }
    return loaders;
}
