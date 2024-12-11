<template>
    <PriceBreakdownBox :price-breakdown="priceBreakdown" />
</template>

<script setup lang="ts">
import { PriceBreakdownBox } from '@stamhoofd/components';
import { BalanceItemWithPayments, DetailedPayableBalance, DetailedReceivableBalance } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    item: DetailedPayableBalance | DetailedReceivableBalance;
}>();

const items = computed(() => props.item.filteredBalanceItems);
const filteredItems = items;

const priceBreakdown = computed(() => {
    const now = new Date();
    const laterBalance = BalanceItemWithPayments.getOutstandingBalance(filteredItems.value.filter(i => i.dueAt !== null && i.dueAt > now));
    const balance = BalanceItemWithPayments.getOutstandingBalance(filteredItems.value.filter(i => i.dueAt === null || i.dueAt <= now));

    const all = [
        {
            name: 'Reeds betaald',
            price: balance.pricePaid,
        },
        {
            name: 'In verwerking',
            price: balance.pricePending,
        },
    ].filter(a => a.price !== 0);

    if (all.length > 0) {
        all.unshift({
            name: 'Totaalprijs',
            price: balance.price,
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
            name: balance.priceOpen < 0 ? 'Terug te krijgen' : (laterBalance.priceOpen !== 0 ? 'Nu te betalen' : 'Te betalen'),
            price: Math.abs(balance.priceOpen),
        },
    ];
});

</script>
