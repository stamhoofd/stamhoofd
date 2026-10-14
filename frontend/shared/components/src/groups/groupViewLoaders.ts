import type { Component, InjectionKey } from 'vue';
import { inject, provide } from 'vue';

export type GroupViewLoaders = {
    editGroup: () => Promise<{ default: Component }>;
};

export const groupViewLoadersKey: InjectionKey<GroupViewLoaders> = Symbol('groupViewLoaders');

export function useProvideGroupViewLoaders(value: GroupViewLoaders) {
    provide(groupViewLoadersKey, value);
}

export function useGroupViewLoaders(): GroupViewLoaders {
    const loaders = inject(groupViewLoadersKey, null);
    if (!loaders) {
        throw new Error('Group view loaders have not been provided');
    }
    return loaders;
}
