import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { LimitedFilteredRequest } from '@stamhoofd/structures';
import { PromiseView } from '../../containers';
import { usePaymentsObjectFetcher } from '../../fetchers';
import { Toast } from '../../overlays/Toast';
import PaymentView from '../PaymentView.vue';

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
                        Toast.error($t(`5e6f043a-6ed5-41eb-b670-d9ac6b63e598`)).show();
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
