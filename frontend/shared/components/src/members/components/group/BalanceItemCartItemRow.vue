<template>
    <STListItem class="right-stack">
        <template #left>
            <figure v-if="item.item.type === BalanceItemType.PlatformMembership" class="style-image-with-icon gray">
                <figure>
                    <span class="icon membership-filled" />
                </figure>
                <aside />
            </figure>
        </template>

        <p v-if="item.item.itemPrefix" class="style-title-prefix-list">
            {{ item.item.itemPrefix }}
        </p>
        
            
        <h3 class="style-title-list">
            <span>{{ item.item.itemTitle }}</span>
        </h3>

        <p class="style-description-small">
            <span>{{ item.item.itemDescription }}</span>
        </p>

        <p class="style-description-small">
            <span>{{ item.item.description }}</span>
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
import { BalanceItemCartItem, BalanceItemType, RegisterCheckout } from '@stamhoofd/structures';

const props = withDefaults(
    defineProps<{
        item: BalanceItemCartItem;
        checkout: RegisterCheckout;
    }>(),
    {}
);

async function deleteMe() {
    props.checkout.removeBalanceItem(props.item)
}

</script>
