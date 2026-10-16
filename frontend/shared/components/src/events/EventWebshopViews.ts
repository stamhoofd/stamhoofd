import type { Component, InjectionKey } from 'vue';

export interface EventWebshopViews {
    overview: () => Promise<Component>;
    edit: () => Promise<{ default: Component }>;
}

export const eventWebshopViewsKey: InjectionKey<EventWebshopViews> = Symbol('eventWebshopViews');
