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
            <button class="button icon trash gray" type="button" @click.stop="deleteMe()" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { BalanceItemCartItem, RegisterCheckout } from '@stamhoofd/structures';
import { BalanceItemIcon, BalanceItemTitleBox } from '../../../payments';

const props = withDefaults(
    defineProps<{
        item: BalanceItemCartItem;
        checkout: RegisterCheckout;
    }>(),
    {},
);

async function deleteMe() {
    props.checkout.removeBalanceItem(props.item);
}

</script>
