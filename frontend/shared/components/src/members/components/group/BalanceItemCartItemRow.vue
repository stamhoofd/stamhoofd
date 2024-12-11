<template>
    <STListItem class="right-stack">
        <template #left>
            <figure class="style-image-with-icon gray">
                <figure>
                    <span class="icon" :class="getBalanceItemTypeIcon(item.item.type)" />
                </figure>
                <aside>
                    <span v-if="item.item.amount <= 0" class="icon disabled small red" />
                    <span v-if="item.item.amount > 1" class="style-bubble primary">
                        {{ item.item.amount }}
                    </span>
                </aside>
            </figure>
        </template>

        <h3 class="style-title-list">
            <span>{{ item.item.itemTitle }}</span>
        </h3>

        <p class="style-description-small pre-wrap" v-text="item.item.itemDescription" />

        <p v-if="item.item.amount === 0" class="style-description-small">
            Annulatie
        </p>

        <template #right>
            <p class="style-price-base">
                {{ formatPrice(item.price) }}
            </p>
            <button class="button icon trash gray" type="button" @click.stop="deleteMe()" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { BalanceItemCartItem, getBalanceItemTypeIcon, RegisterCheckout } from '@stamhoofd/structures';

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
