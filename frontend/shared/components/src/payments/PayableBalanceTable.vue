<template>
    <p v-if="filteredItems.length === 0" class="info-box">
        {{ $t('%h9') }}
    </p>
    <template v-else>
        <GroupedBalanceList :item="item" />
        <BalancePriceBreakdown :item="item" />
        <p class="style-button-bar right-align">
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

defineEmits(['checkout'])
const items = computed(() => props.item.filteredBalanceItems);
const filteredItems = items;

</script>
