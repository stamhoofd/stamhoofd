<template>
    <STListItem class="right-stack">
        <template #left>
            <BalanceItemIcon :item="item.item" :is-payable="true" />
        </template>

        <BalanceItemTitleBox :item="item.item" :is-payable="true" :price="item.price" />

        <template #right>
            <p class="style-price-base">
                {{ formatPrice(item.price) }}
            </p>
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import type { BalanceItemCartItem } from '@stamhoofd/structures';
import BalanceItemIcon from '#payments/BalanceItemIcon.vue';
import BalanceItemTitleBox from '#payments/BalanceItemTitleBox.vue';

const props = withDefaults(
    defineProps<{
        item: BalanceItemCartItem;
    }>(),
    {},
);

</script>
