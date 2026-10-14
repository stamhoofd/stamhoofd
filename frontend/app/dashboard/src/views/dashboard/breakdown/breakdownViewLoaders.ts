import type { Component, InjectionKey } from 'vue';
import { inject, provide } from 'vue';

export type BreakdownViewLoaders = {
    payments: () => Promise<{ default: Component }>;
    balanceItems: () => Promise<{ default: Component }>;
    paymentsTable: () => Promise<{ default: Component }>;
    balanceItemsTable: () => Promise<{ default: Component }>;
};

const breakdownViewLoadersKey: InjectionKey<BreakdownViewLoaders> = Symbol('breakdownViewLoaders');

export function useProvideBreakdownViewLoaders(value: BreakdownViewLoaders) {
    provide(breakdownViewLoadersKey, value);
}

export function useBreakdownViewLoaders(): BreakdownViewLoaders {
    const loaders = inject(breakdownViewLoadersKey, null);
    if (!loaders) {
        throw new Error('Breakdown view loaders have not been provided');
    }
    return loaders;
}
