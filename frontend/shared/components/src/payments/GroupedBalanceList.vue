<template>
    <STGrid>
        <BalanceItemRow v-for="group in groupedItems" :key="group.id" :has-write="hasWrite" :item="group" :is-payable="isPayable" :exclude-vat="excludeVat" />
    </STGrid>
</template>

<script setup lang="ts">
import type { DetailedReceivableBalance } from '@stamhoofd/structures';
import { DetailedPayableBalance, GroupedBalanceItems } from '@stamhoofd/structures';
import { computed } from 'vue';
import BalanceItemRow from './BalanceItemRow.vue';
import STGrid from '../layout/STGrid.vue';

const props = withDefaults(
    defineProps<{
        item: DetailedPayableBalance | DetailedReceivableBalance;

        /**
         * Show the prices excluding VAT (used together with a separate VAT overview).
         */
        excludeVat?: boolean;
    }>(),
    {
        excludeVat: false,
    },
);
const isPayable = props.item instanceof DetailedPayableBalance;

const items = computed(() => isPayable ? props.item.payableBalanceItems : props.item.filteredBalanceItems);
const filteredItems = items;
const hasWrite = !isPayable;

const groupedItems = computed(() => {
    return GroupedBalanceItems.group(filteredItems.value);
});

</script>
