<template>
    <div class="product-grid" :class="{single: products.length === 1}">
        <ProductBox v-for="product in products" :key="product.id" :product="product" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :admin="admin" />
    </div>
</template>

<script lang="ts" setup>
import type { useDismiss } from '@simonbackx/vue-app-navigation';
import type { CartItem, Checkout, Product, Webshop } from '@stamhoofd/structures';

import ProductBox from './ProductBox.vue';

withDefaults(defineProps<{
    admin?: boolean;
    products: Product[];
    webshop: Webshop;
    checkout: Checkout;
    saveHandler: (
        newItem: CartItem,
        oldItem: CartItem | null,
        component: { dismiss: ReturnType<typeof useDismiss>; canDismiss: boolean },
    ) => void;
}>(), {
    admin: false,
});
</script>

<style lang="scss">
.product-grid {
    display: grid;
    gap: 0;
    grid-template-columns: 1fr;
}

.enable-grid .product-grid {
    @media (min-width: 801px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;

        &.single {
            grid-template-columns: 1fr;
        }
    }
}
</style>
