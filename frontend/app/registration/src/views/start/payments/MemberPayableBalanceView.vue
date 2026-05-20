<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <PayableBalanceCollectionView v-if="payableBalanceCollection" :collection="payableBalanceCollection" :single-organization="false" @checkout="checkout" />
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import type { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, useDismiss, useShow } from '@simonbackx/vue-app-navigation';
import type { NavigationActions } from '@stamhoofd/components';
import { GlobalEventBus, Toast, usePlatform } from '@stamhoofd/components';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import PayableBalanceCollectionView from '@stamhoofd/components/payments/PayableBalanceCollectionView.vue';
import SelectBalanceItemsView from '@stamhoofd/components/payments/SelectBalanceItemsView.vue';
import { useMemberManager } from '@stamhoofd/networking';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { BalanceItem, BalanceItemPaymentDetailed, DetailedPayableBalance, RegisterCheckout } from '@stamhoofd/structures';
import { DetailedPayableBalanceCollection } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { ref } from 'vue';

const owner = useRequestOwner();
const context = useContext();
const errors = useErrors();
const payableBalanceCollection = ref(null) as Ref<DetailedPayableBalanceCollection | null>;
const memberManager = useMemberManager()
const show = useShow();
const platform = usePlatform();
const dismiss = useDismiss();

updateBalance().catch(console.error);

// Fetch balance
async function updateBalance() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/user/payable-balance/detailed`,
            decoder: DetailedPayableBalanceCollection as Decoder<DetailedPayableBalanceCollection>,
            shouldRetry: true,
            owner,
            timeout: 5 * 60 * 1000,
        });

        payableBalanceCollection.value = response.data;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function checkout(item: DetailedPayableBalance) {
    const checkout = memberManager.family.checkout;
    const items = item.filteredBalanceItems;

    if (items.length > 1) {
        return await show({
            components: [
                new ComponentWithProperties(
                    SelectBalanceItemsView,
                    {
                        title: $t(`%1Qf`),
                        items,
                        isPayable: true,
                        canCustomizeItemValue: (item: BalanceItem) => {
                            return item.organizationId !== platform.value.membershipOrganizationId;
                        },
                        saveHandler: async (navigate: NavigationActions, list: BalanceItemPaymentDetailed[]) => {
                            // First clear
                            for (const g of items) {
                                checkout.removeBalanceItemByBalance(g);
                            }

                            // Then add
                            for (const g of list) {
                                if (g.price !== 0) {
                                    checkout.addBalanceItem(g.balanceItem, g.price)
                                }
                            }

                            await navigate.pop({ force: true });
                            await goToCheckout(checkout, item);
                        },
                    },
                ),
            ],
        });
    }

    for (const g of items) {
        const open = g.priceOpen;

        if (open !== 0) {
            checkout.addBalanceItem(g, open);
        }
    }

    await goToCheckout(checkout, item);
}

async function goToCheckout(checkout: RegisterCheckout, item: DetailedPayableBalance) {
    checkout.defaultOrganization = item.organization;
    Toast.success($t(`%10h`)).setIcon('basket').show();
    await dismiss({ force: true });
    await GlobalEventBus.sendEvent('selectTabById', 'cart');
}


</script>
