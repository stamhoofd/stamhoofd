<template>
    <STListItem class="right-stack">
        <template #left>
            <figure class="style-image-with-icon gray">
                <figure>
                    <span class="icon" :class="getBalanceItemTypeIcon(item.item.type)" />
                </figure>
                <aside>
                    <span v-if="item.item.amount > 1" class="style-bubble primary">
                        {{ item.item.amount }}
                    </span>
                </aside>
            </figure>
        </template>

        <p v-if="item.item.status === BalanceItemStatus.Canceled && item.price <= 0" class="style-title-prefix-list error">
            <span>Tegoed wegens annulatie</span>
            <span class="icon disabled small" />
        </p>
        <p v-else-if="item.price < 0" class="style-title-prefix-list">
            <span>Tegoed</span>
            <span class="icon undo small" />
        </p>
        <h3 class="style-title-list">
            <span>{{ item.item.itemTitle }}</span>
        </h3>

        <p class="style-description-small pre-wrap" v-text="item.item.itemDescription" />

        <template #right>
            <p class="style-price-base">
                {{ formatPrice(item.price) }}
            </p>
            <button class="button icon trash gray" type="button" @click.stop="deleteMe()" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { BalanceItemCartItem, BalanceItemStatus, getBalanceItemTypeIcon, RegisterCheckout } from '@stamhoofd/structures';

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
