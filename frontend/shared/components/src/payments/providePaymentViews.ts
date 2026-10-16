import { useProvidePaymentViewLoaders } from '#payments/paymentViewLoaders.ts';

export function useProvidePaymentViews() {
    useProvidePaymentViewLoaders({
        asyncPayment: async () => (await import('#payments/AsyncPaymentView.vue')).default,
    });
}
