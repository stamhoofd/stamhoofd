<template>
    <div v-if="filteredItems.length !== 0 || !showName" class="container">
        <hr><h2>
            {{ !showName ? $t('%1Ni') : $t('%vX', {organization: item.organization.name}) }}
        </h2>

        <p v-if="filteredItems.length === 0" class="info-box">
            {{ $t('%h9') }}
        </p>
        <template v-else>
            <GroupedBalanceList :item="item" />

            <BalancePriceBreakdown :item="item" />

            <p class="style-button-bar right-align">
                <button class="button primary" type="button" @click="checkout">
                    <span>{{ $t('%eX') }}</span>
                    <span class="icon arrow-right" />
                </button>
            </p>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, useDismiss, useShow } from '@simonbackx/vue-app-navigation';
import { GlobalEventBus } from '#EventBus.ts';
import type { NavigationActions } from '#types/NavigationActions.ts';
import SelectBalanceItemsView from '#payments/SelectBalanceItemsView.vue';
import { Toast } from '#overlays/Toast.ts';
import { useAppContext } from '#context/appContext.ts';
import { useOrganizationCart } from '#members/checkout/useCheckoutRegisterItem.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useMemberManager } from '@stamhoofd/networking/MemberManager';
import type { BalanceItem, BalanceItemPaymentDetailed, DetailedPayableBalance} from '@stamhoofd/structures';
import { BalanceItemCartItem, RegisterCheckout } from '@stamhoofd/structures';
import { computed } from 'vue';
import BalancePriceBreakdown from './BalancePriceBreakdown.vue';
import GroupedBalanceList from './GroupedBalanceList.vue';

const props = defineProps<{
    item: DetailedPayableBalance;
    showName: boolean;
}>();

const items = computed(() => props.item.filteredBalanceItems);
const openCart = useOrganizationCart();
const app = useAppContext();
const memberManager = useMemberManager();
const dismiss = useDismiss();
const show = useShow();
const platform = usePlatform();

const filteredItems = items;

async function checkout() {
    let checkout = new RegisterCheckout();

    if (app === 'registration') {
        // Use member manager
        checkout = memberManager.family.checkout;
    }

    if (items.value.length > 1) {
        return await show({
            components: [
                new ComponentWithProperties(
                    SelectBalanceItemsView,
                    {
                        title: $t(`%10g`),
                        items: items.value,
                        isPayable: true,
                        canCustomizeItemValue: (item: BalanceItem) => {
                            return item.organizationId !== platform.value.membershipOrganizationId;
                        },
                        saveHandler: async (navigate: NavigationActions, list: BalanceItemPaymentDetailed[]) => {
                            // First clear
                            for (const g of filteredItems.value) {
                                checkout.removeBalanceItemByBalance(g);
                            }

                            // Then add
                            for (const g of list) {
                                if (g.price !== 0) {
                                    checkout.addBalanceItem(BalanceItemCartItem.create({
                                        item: g.balanceItem,
                                        price: g.price,
                                    }));
                                }
                            }

                            await navigate.pop({ force: true });
                            await goToCheckout(checkout);
                        },
                    },
                ),
            ],
        });
    }

    for (const g of filteredItems.value) {
        const open = g.priceOpen;

        if (open !== 0) {
            checkout.addBalanceItem(BalanceItemCartItem.create({
                item: g,
                price: open,
            }));
        }
    }

    await goToCheckout(checkout);
}

async function goToCheckout(checkout: RegisterCheckout) {
    if (app === 'registration') {
        checkout.defaultOrganization = props.item.organization;
        Toast.success($t(`%10h`)).setIcon('basket').show();
        await dismiss({ force: true });
        await GlobalEventBus.sendEvent('selectTabById', 'cart');
        return;
    }

    await openCart({
        organization: props.item.organization,
        checkout,
    });
}

</script>
