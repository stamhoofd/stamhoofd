<template>
    <div class="webshop-products container">
        <template v-if="bulk">
            <BulkProductList :hide-title="hideListTitle" />

            <div class="style-button-bar">
                <button type="button" class="button primary full" data-testid="bulk-order-button" @click="emit('startBulkOrder')">
                    <span>{{ orderButtonText }}</span>
                    <span v-if="totalPrice > 0" class="bulk-total">{{ formatPrice(totalPrice) }}</span>
                    <span class="icon arrow-right" />
                </button>
            </div>
        </template>
        <template v-else-if="single">
            <SingleProductList v-if="products.length > 1" v-model="selectedProductId" :webshop="webshop" :cart="checkout.cart" :hide-title="hideListTitle" />

            <div class="style-button-bar">
                <button type="button" class="button primary full" data-testid="single-order-button" @click="openSelectedProduct">
                    <span>{{ orderButtonText }}</span>
                    <span class="icon arrow-right" />
                </button>
            </div>
        </template>
        <div v-else class="products">
            <CategoryBox v-for="(category, index) in categories" :key="category.id" :category="category" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :is-last="index === categories.length - 1" />
            <ProductGrid v-if="categories.length === 0" :products="products" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { useDismiss } from '@browser/navigation';
import CategoryBox from '@stamhoofd/components/views/CategoryBox.vue';
import ProductGrid from '@stamhoofd/components/views/ProductGrid.vue';
import type { CartItem, Category, Checkout, Product, Webshop } from '@stamhoofd/structures';
import { WebshopOrderMode } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { getOrderButtonText } from '@stamhoofd/components/helpers/webshopWording.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import BulkProductList from '../products/BulkProductList.vue';
import { canOrderProduct } from '../products/productList';
import SingleProductList from '../products/SingleProductList.vue';

/**
 * The part of the webshop page to order from: the products with a cart, the list with an amount per product in bulk
 * mode, or in single mode an order button (with a list to pick one product when there are several)
 */
const props = defineProps<{
    webshop: Webshop;
    checkout: Checkout;
    products: Product[];
    categories: Category[];
    /**
     * Bulk and single mode: hides the title of a list without categories, e.g. when it follows the title of the webshop
     */
    hideListTitle?: boolean;
    saveHandler: (
        newItem: CartItem,
        oldItem: CartItem | null,
        component: { dismiss: ReturnType<typeof useDismiss>; canDismiss: boolean },
    ) => void;
}>();

const emit = defineEmits<{
    openSingleProduct: [product: Product];
    startBulkOrder: [];
}>();

const bulk = computed(() => props.webshop.orderMode === WebshopOrderMode.Bulk);
const totalPrice = computed(() => props.checkout.totalPrice);

const single = computed(() => props.webshop.orderMode === WebshopOrderMode.Single);

// Starts at the product of an earlier visit: in single mode the cart only holds the item of the chosen product
const selectedProductId = ref<string | null>(props.checkout.cart.items.find(i => props.products.some(p => p.id === i.product.id))?.product.id ?? null);

function openSelectedProduct() {
    // The choice of an earlier visit can no longer be orderable (e.g. sold out): its radio is disabled
    const product = props.products.length === 1 ? props.products[0] : props.products.find(p => p.id === selectedProductId.value && canOrderProduct(p));
    if (!product) {
        Toast.warning($t('Maak eerst een keuze')).show();
        return;
    }
    emit('openSingleProduct', product);
}
// In single mode the amount is chosen after this button
const orderButtonText = computed(() => getOrderButtonText(props.webshop, bulk.value ? totalPrice.value : undefined));
</script>

<style lang="scss">
.webshop-products .bulk-total {
    opacity: 0.7;
    padding-left: 5px;
}
</style>
