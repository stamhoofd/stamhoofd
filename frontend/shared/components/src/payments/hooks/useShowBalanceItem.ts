import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { LimitedFilteredRequest } from '@stamhoofd/structures';
import { useBalanceItemsFetcher } from '#fetchers/useBalanceItemsObjectFetcher.ts';
import { Toast } from '#overlays/Toast.ts';

import PromiseView from '#containers/PromiseView.vue';

export function useShowBalanceItem() {
    const present = usePresent();
    const fetcher = useBalanceItemsFetcher();

    return async (balanceItemId: string) => {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PromiseView, {
                promise: async () => {
                    const balanceItems = await fetcher.fetch(new LimitedFilteredRequest({
                        filter: {
                            id: balanceItemId,
                        },
                        limit: 1,
                    }));
                    if (balanceItems.results.length === 0) {
                        Toast.error($t('Dit openstaand bedrag werd niet gevonden')).show();
                        throw new Error('Balance item not found');
                    }
                    return AsyncComponent(() => import('#payments/EditBalanceItemView.vue'), {
                        balanceItem: balanceItems.results[0],
                        isNew: false,
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
