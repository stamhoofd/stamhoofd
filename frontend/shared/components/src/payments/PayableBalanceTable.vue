<template>
    <div v-if="filteredItems.length !== 0 || !showName" class="container">
        <hr><h2>
            {{ !showName ? $t('a44d9f94-a83a-49b9-9a89-833b7873fc74') : $t('6030bf67-f3ec-48f1-8c00-be3e3f745351', {organization: item.organization.name}) }}
        </h2>

        <p v-if="filteredItems.length === 0" class="info-box">
            {{ $t('7fc1d8ac-e765-41e9-a440-c5fddb30c1af') }}
        </p>
        <template v-else>
            <GroupedBalanceList :item="item" />

            <BalancePriceBreakdown :item="item" />

            <p class="style-button-bar right-align">
                <button class="button primary" type="button" @click="checkout">
                    <span>{{ $t('e3f37ccd-a27c-4455-96f4-e33b74ae879e') }}</span>
                    <span class="icon arrow-right" />
                </button>
            </p>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, useDismiss, useShow } from '@simonbackx/vue-app-navigation';
import { GlobalEventBus, SelectBalanceItemsView, Toast, useAppContext, useOrganizationCart } from '@stamhoofd/components';
import { useMemberManager } from '@stamhoofd/networking';
import { BalanceItemCartItem, BalanceItemPaymentDetailed, DetailedPayableBalance, RegisterCheckout } from '@stamhoofd/structures';
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
                        title: $t(`Kies welke zaken je nu wil betalen`),
                        items: items.value,
                        isPayable: true,
                        saveHandler: async (list: BalanceItemPaymentDetailed[]) => {
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
        Toast.success($t(`Openstaande rekening toegevoegd aan winkelmandje. Reken je winkelmandje af of voeg eventueel nog andere zaken toe.`)).setIcon('basket').show();
        await dismiss({ force: true });
        await GlobalEventBus.sendEvent('selectTabByName', 'mandje');
        return;
    }

    await openCart({
        organization: props.item.organization,
        checkout,
    });
}

</script>
