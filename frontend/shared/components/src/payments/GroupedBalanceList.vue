<template>
    <STList>
        <BalanceItemRow v-for="group in groupedItems" :key="group.id" :has-write="hasWrite" :item="group" :is-payable="isPayable" />
    </STList>
</template>

<script setup lang="ts">
import { DetailedPayableBalance, DetailedReceivableBalance, GroupedBalanceItems } from '@stamhoofd/structures';
import { computed } from 'vue';
import BalanceItemRow from './BalanceItemRow.vue';

const props = defineProps<{
    item: DetailedPayableBalance | DetailedReceivableBalance;
}>();
const isPayable = props.item instanceof DetailedPayableBalance;

const items = computed(() => props.item.filteredBalanceItems);
const filteredItems = items;
const hasWrite = !isPayable;

const groupedItems = computed(() => {
    return GroupedBalanceItems.group(filteredItems.value);
});

</script>
