<template>
    <PriceBreakdownBox :price-breakdown="priceBreakdown" />
</template>

<script setup lang="ts">
import PriceBreakdownBox from '#views/PriceBreakdownBox.vue';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { DetailedReceivableBalance } from '@stamhoofd/structures';
import { BalanceItem, DetailedPayableBalance } from '@stamhoofd/structures';
import { computed } from 'vue';
import { usePositionableSheet } from '#tables/usePositionableSheet.ts';


const props = defineProps<{
    item: DetailedPayableBalance | DetailedReceivableBalance;
}>();

const isPayable = props.item instanceof DetailedPayableBalance;

const priceBreakdown = computed(() => {
    const now = BalanceItem.getDueOffset();
    const laterBalance = BalanceItem.getOutstandingBalance(props.item.filteredBalanceItems.filter(i => i.dueAt !== null && i.dueAt > now));
    const balance = BalanceItem.getOutstandingBalance(props.item.filteredBalanceItems.filter(i => i.dueAt === null || i.dueAt <= now));
    
    const discountBalance = isPayable ? BalanceItem.getOutstandingBalance(props.item.discountBalanceItems) : BalanceItem.getOutstandingBalance([])

    if (balance.priceOpen < 0) {
        if (laterBalance.priceOpen > 0) {
            // Let it fill in the gap
            const max = -balance.priceOpen;
            balance.priceOpen = Math.min(0, balance.priceOpen + laterBalance.priceOpen);
            laterBalance.priceOpen -= Math.min(max, laterBalance.priceOpen);
        }
    }

    const paid = balance.pricePaid + laterBalance.pricePaid - discountBalance.pricePaid;

    const all = [
        {
            name: $t(`Tegoed`),
            price: discountBalance.priceOpen, // only relevant shown
            action: {
                icon: 'info-circle',
                handler: showDiscountSheet
            }
        },
        {
            name: paid >= 0 ? $t(`%ly`) : $t('Reeds teruggekregen'),
            price: paid, // don't include discounts here
        },
        {
            name: $t(`%1PL`),
            price: balance.pricePending + laterBalance.pricePending - discountBalance.pricePending, // don't include discounts here
        },
    ].filter(a => a.price !== 0);

    if (all.length > 0) {
        all.unshift({
            name: $t(`%lz`),
            price: balance.payablePriceWithVAT + laterBalance.payablePriceWithVAT - discountBalance.payablePriceWithVAT,
        });
    }

    if (laterBalance.priceOpen > 0) {
        all.push({
            name: $t(`%10Z`),
            price: laterBalance.priceOpen,
        });
    }

    return [
        ...all,
        {
            name: balance.priceOpen < 0 ? (isPayable ? $t(`%10a`) : $t(`%10b`)) : (laterBalance.priceOpen !== 0 ? $t(`%10c`) : $t(`%m0`)),
            price: Math.abs(balance.priceOpen),
        },
    ];
});


const { presentPositionableSheet } = usePositionableSheet();

async function showDiscountSheet(event: MouseEvent) {
    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./components/DiscountsSheet.vue'), {
                    items: props.item.discountBalanceItems
                }),
            }),
        ],
    }, { minimumHeight: 185, width: 500 });
}


</script>
