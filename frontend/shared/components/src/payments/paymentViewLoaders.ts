import type { Component, InjectionKey } from 'vue';
import { inject, provide } from 'vue';

export type PaymentViewLoaders = {
    asyncPayment: () => Promise<Component>;
};

export const paymentViewLoadersKey: InjectionKey<PaymentViewLoaders> = Symbol('paymentViewLoaders');

export function useProvidePaymentViewLoaders(value: PaymentViewLoaders) {
    provide(paymentViewLoadersKey, value);
}

export function usePaymentViewLoaders(): PaymentViewLoaders {
    const loaders = inject(paymentViewLoadersKey, null);
    if (!loaders) {
        throw new Error('Payment view loaders have not been provided');
    }
    return loaders;
}
