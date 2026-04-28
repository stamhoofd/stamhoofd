<template>
    <PriceBreakdownBox :price-breakdown="priceBreakdown" />
</template>

<script setup lang="ts">
import PriceBreakdownBox from '#views/PriceBreakdownBox.vue';
import type { DetailedReceivableBalance } from '@stamhoofd/structures';
import { BalanceItem, DetailedPayableBalance } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    item: DetailedPayableBalance | DetailedReceivableBalance;
}>();

const items = computed(() => props.item.filteredBalanceItems);
const filteredItems = items;
const isPayable = props.item instanceof DetailedPayableBalance;

const priceBreakdown = computed(() => {
    const now = BalanceItem.getDueOffset();
    const laterBalance = BalanceItem.getOutstandingBalance(filteredItems.value.filter(i => i.dueAt !== null && i.dueAt > now));
    const balance = BalanceItem.getOutstandingBalance(filteredItems.value.filter(i => i.dueAt === null || i.dueAt <= now));

    if (balance.priceOpen < 0) {
        if (laterBalance.priceOpen > 0) {
            // Let it fill in the gap
            const max = -balance.priceOpen;
            balance.priceOpen = Math.min(0, balance.priceOpen + laterBalance.priceOpen);
            laterBalance.priceOpen -= Math.min(max, laterBalance.priceOpen);
        }
    }

    const all = [
        {
            name: $t(`%ly`),
            price: balance.pricePaid + laterBalance.pricePaid,
        },
        {
            name: $t(`%1PL`),
            price: balance.pricePending + laterBalance.pricePending,
        },
    ].filter(a => a.price !== 0);

    if (all.length > 0) {
        all.unshift({
            name: $t(`%lz`),
            price: balance.payablePriceWithVAT + laterBalance.payablePriceWithVAT,
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

</script>
