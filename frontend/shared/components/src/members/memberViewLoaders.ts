import type { Component, InjectionKey } from 'vue';
import { inject, provide } from 'vue';

export type MemberViewLoaders = {
    details: () => Promise<{ default: Component }>;
};

export const memberViewLoadersKey: InjectionKey<MemberViewLoaders> = Symbol('memberViewLoaders');

export function useProvideMemberViewLoaders(value: MemberViewLoaders) {
    provide(memberViewLoadersKey, value);
}

export function useMemberViewLoaders(): MemberViewLoaders {
    const loaders = inject(memberViewLoadersKey, null);
    if (!loaders) {
        throw new Error('Member view loaders have not been provided');
    }
    return loaders;
}
