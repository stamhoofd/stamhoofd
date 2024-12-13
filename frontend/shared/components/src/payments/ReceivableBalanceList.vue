<template>
    <STList>
        <BalanceItemRow v-for="i in filteredItems" :key="i.id" :has-write="hasWrite" :item="i" :is-payable="false" />
    </STList>
</template>

<script lang="ts" setup>
import { DetailedReceivableBalance } from '@stamhoofd/structures';
import { computed } from 'vue';
import BalanceItemRow from './BalanceItemRow.vue';
const props = withDefaults(
    defineProps<{
        item: DetailedReceivableBalance;
        hasWrite?: boolean;
    }>(),
    {
        hasWrite: true,
    },
);
const items = computed(() => props.item.filteredBalanceItems);
const filteredItems = items;

</script>
