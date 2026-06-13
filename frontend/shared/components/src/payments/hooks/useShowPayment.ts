import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { LimitedFilteredRequest } from '@stamhoofd/structures';
import { usePaymentsObjectFetcher } from '#fetchers/usePaymentsObjectFetcher.ts';
import { Toast } from '../../overlays/Toast';
import PaymentView from '../PaymentView.vue';
import PromiseView from '#containers/PromiseView.vue';

export function useShowPayment() {
    const present = usePresent();
    const paymentFetcher = usePaymentsObjectFetcher();

    return async (paymentId: string) => {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PromiseView, {
                promise: async () => {
                    const payments = await paymentFetcher.fetch(new LimitedFilteredRequest({
                        filter: {
                            id: paymentId,
                        },
                        limit: 1,
                    }));
                    if (payments.results.length === 0) {
                        Toast.error($t(`%yW`)).show();
                        throw new Error('Payment not found');
                    }
                    return new ComponentWithProperties(PaymentView, {
                        payment: payments.results[0],
                    });
                },
            }),
        });

        await present({
            components: [component],
            modalDisplayStyle: 'popup',
        });
    };
}
