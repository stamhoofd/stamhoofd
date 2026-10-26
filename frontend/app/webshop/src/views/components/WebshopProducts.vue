<template>
    <div class="webshop-products container">
        <div v-if="singleProduct" class="style-button-bar">
            <button type="button" class="button primary full" data-testid="single-order-button" @click="emit('openSingleProduct', singleProduct)">
                <span>{{ orderButtonText }}</span>
                <span class="icon arrow-right" />
            </button>
        </div>
        <div v-else class="products">
            <CategoryBox v-for="(category, index) in categories" :key="category.id" :category="category" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :is-last="index === categories.length - 1" />
            <ProductGrid v-if="categories.length === 0" :products="products" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { useDismiss } from '@simonbackx/vue-app-navigation';
import CategoryBox from '@stamhoofd/components/views/CategoryBox.vue';
import ProductGrid from '@stamhoofd/components/views/ProductGrid.vue';
import type { CartItem, Category, Checkout, Product, Webshop } from '@stamhoofd/structures';
import { WebshopOrderMode } from '@stamhoofd/structures';
import { computed } from 'vue';
import { getOrderButtonText } from '@stamhoofd/components/helpers/webshopWording.ts';

/**
 * The part of the webshop page to order from: the products, or a single order button in single mode with one product
 */
const props = defineProps<{
    webshop: Webshop;
    checkout: Checkout;
    products: Product[];
    categories: Category[];
    saveHandler: (
        newItem: CartItem,
        oldItem: CartItem | null,
        component: { dismiss: ReturnType<typeof useDismiss>; canDismiss: boolean },
    ) => void;
}>();

const emit = defineEmits<{
    openSingleProduct: [product: Product];
}>();

const singleProduct = computed(() => props.webshop.orderMode === WebshopOrderMode.Single && props.products.length === 1 ? props.products[0] : null);
const orderButtonText = computed(() => getOrderButtonText(props.webshop));
</script>
