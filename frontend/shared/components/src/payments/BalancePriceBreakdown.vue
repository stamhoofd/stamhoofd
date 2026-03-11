<template>
    <PriceBreakdownBox :price-breakdown="priceBreakdown" />
</template>

<script setup lang="ts">
import { PriceBreakdownBox } from '@stamhoofd/components';
import { BalanceItem, DetailedPayableBalance, DetailedReceivableBalance } from '@stamhoofd/structures';
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
            name: $t(`057ffcea-70b1-44a9-ad01-c60f6fbd7393`),
            price: balance.pricePaid + laterBalance.pricePaid,
        },
        {
            name: $t(`5c75e9bf-1b64-4d28-a435-6e33247d5170`),
            price: balance.pricePending + laterBalance.pricePending,
        },
    ].filter(a => a.price !== 0);

    if (all.length > 0) {
        all.unshift({
            name: $t(`8dfbd01b-feb1-4b7e-a1f1-2daf19fb2775`),
            price: balance.payablePriceWithVAT + laterBalance.payablePriceWithVAT,
        });
    }

    if (laterBalance.priceOpen > 0) {
        all.push({
            name: $t(`3b051406-b285-4f04-a80d-b98c966cbb1c`),
            price: laterBalance.priceOpen,
        });
    }

    return [
        ...all,
        {
            name: balance.priceOpen < 0 ? (isPayable ? $t(`89bb9c20-d3f5-43ff-846c-47a23517274a`) : $t(`38ff3cca-3877-4202-9c71-9437a12fb876`)) : (laterBalance.priceOpen !== 0 ? $t(`35337319-2bc6-41d6-9427-c1974d8a37ae`) : $t(`18aed6d0-0880-4d06-9260-fe342e6e8064`)),
            price: Math.abs(balance.priceOpen),
        },
    ];
});

</script>
