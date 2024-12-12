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
            name: 'Reeds betaald',
            price: balance.pricePaid + laterBalance.pricePaid,
        },
        {
            name: 'In verwerking',
            price: balance.pricePending + laterBalance.pricePending,
        },
    ].filter(a => a.price !== 0);

    if (all.length > 0) {
        all.unshift({
            name: 'Totaalprijs',
            price: balance.price + laterBalance.price,
        });
    }

    if (laterBalance.priceOpen > 0) {
        all.push({
            name: 'Later te betalen',
            price: laterBalance.priceOpen,
        });
    }

    return [
        ...all,
        {
            name: balance.priceOpen < 0 ? (isPayable ? 'Terug te krijgen' : 'Terug te betalen') : (laterBalance.priceOpen !== 0 ? 'Nu te betalen' : 'Te betalen'),
            price: Math.abs(balance.priceOpen),
        },
    ];
});

</script>
