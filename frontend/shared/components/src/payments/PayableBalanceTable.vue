<template>
    <p v-if="payableBalanceItems.length === 0" class="info-box">
        {{ $t('%h9') }}
    </p>
    <template v-if="items.length">
        <GroupedBalanceList :item="item" :exclude-vat="hasExclusiveVAT" />
        <BalancePriceBreakdown :item="item" />
        <p v-if="payableBalanceItems.length" class="style-button-bar right-align">
            <button class="button primary" type="button" @click="$emit('checkout')">
                <span>{{ $t('%eX') }}</span>
                <span class="icon arrow-right" />
            </button>
        </p>
    </template>
</template>

<script setup lang="ts">
import type { DetailedPayableBalance } from '@stamhoofd/structures';
import { computed } from 'vue';
import BalancePriceBreakdown from './BalancePriceBreakdown.vue';
import GroupedBalanceList from './GroupedBalanceList.vue';

const props = defineProps<{
    item: DetailedPayableBalance;
}>();

defineEmits(['checkout']);
const items = computed(() => props.item.filteredBalanceItems);
const payableBalanceItems = computed(() => props.item.payableBalanceItems);
const hasExclusiveVAT = computed(() => props.item.hasExclusiveVAT);

</script>
