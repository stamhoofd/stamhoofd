<template>
    <div v-if="filteredItems.length !== 0 || !showName" class="container">
        <hr>
        <h2>
            Openstaand<template v-if="showName">
                bij {{ item.organization.name }}
            </template>
        </h2>

        <p v-if="filteredItems.length === 0" class="info-box">
            Je hebt geen openstaande schulden
        </p>
        <template v-else>
            <GroupedBalanceList :item="item" />

            <p class="style-button-bar right-align">
                <button class="button primary" type="button" @click="checkout">
                    <span>Betalen</span>
                    <span class="icon arrow-right" />
                </button>
            </p>
        </template>
    </div>
</template>

<script setup lang="ts">
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { GlobalEventBus, Toast, useAppContext, useOrganizationCart } from '@stamhoofd/components';
import { useMemberManager } from '@stamhoofd/networking';
import { BalanceItemCartItem, BalanceItemWithPayments, DetailedPayableBalance, RegisterCheckout } from '@stamhoofd/structures';
import { computed } from 'vue';
import GroupedBalanceList from './GroupedBalanceList.vue';

const props = defineProps<{
    item: DetailedPayableBalance;
    showName: boolean;
}>();

const items = computed(() => props.item.balanceItems);
const openCart = useOrganizationCart();
const app = useAppContext();
const memberManager = useMemberManager();
const dismiss = useDismiss();

const filteredItems = computed(() => {
    return items.value.filter(i => BalanceItemWithPayments.getOutstandingBalance([i]).totalOpen !== 0);
});

async function checkout() {
    let checkout = new RegisterCheckout();

    if (app === 'registration') {
        // Use member manager
        checkout = memberManager.family.checkout;
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

    if (app === 'registration') {
        checkout.defaultOrganization = props.item.organization;
        Toast.success('Openstaande rekening toegevoegd aan winkelmandje. Reken je winkelmandje af of voeg eventueel nog andere zaken toe.').setIcon('basket').show();
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
