<template>
    <div class="category-box container">
        <h2 class="larger">
            {{ category.name }}
        </h2>
        <p v-if="category.description.length > 0" class="style-description-small" v-text="category.description" />

        <ProductGrid :products="products" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :admin="admin" />
        <hr v-if="!isLast">
    </div>
</template>

<script lang="ts" setup>
import type { useDismiss } from '@simonbackx/vue-app-navigation';
import type { CartItem, Category, Checkout, Webshop } from '@stamhoofd/structures';
import { computed } from 'vue';

import ProductGrid from './ProductGrid.vue';

const props = withDefaults(defineProps<{
    admin?: boolean;
    category: Category;
    webshop: Webshop;
    isLast?: boolean;
    checkout: Checkout;
    saveHandler: (
        newItem: CartItem,
        oldItem: CartItem | null,
        component: { dismiss: ReturnType<typeof useDismiss>; canDismiss: boolean },
    ) => void;
}>(), {
    admin: false,
    isLast: false,
});

const products = computed(() => props.category.productIds.flatMap((id) => {
    const product = props.webshop.products.find(p => p.id === id);
    if (product && (!product.hidden || props.admin)) {
        return [product];
    }
    return [];
}));
</script>

<style lang="scss">
.category-box > p {
    padding-bottom: 20px;
    white-space: pre-wrap;
}
</style>
