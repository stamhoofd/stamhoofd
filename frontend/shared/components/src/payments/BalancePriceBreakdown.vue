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

const items = computed(() => props.item.balanceItems);
const filteredItems = computed(() => {
    return items.value.filter(i => BalanceItemWithPayments.getOutstandingBalance([i]).priceOpen !== 0);
});

const priceBreakdown = computed(() => {
    const balance = BalanceItemWithPayments.getOutstandingBalance(filteredItems.value);

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

    return [
        ...all,
        {
            name: balance.priceOpen < 0 ? 'Terug te krijgen' : 'Te betalen',
            price: Math.abs(balance.priceOpen),
        },
    ];
});

</script>
