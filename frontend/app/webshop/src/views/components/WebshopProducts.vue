<template>
    <div class="webshop-products container" :class="{ 'with-sticky-order-bar': bulk && hasUnits }">
        <template v-if="bulk">
            <BulkProductList :title="listTitle" />

            <div class="style-button-bar bulk-order-bar" :class="{ sticky: hasUnits }">
                <button type="button" class="button primary full" data-testid="bulk-order-button" @click="emit('startBulkOrder')">
                    <span>{{ orderButtonText }}</span>
                    <span v-if="totalPrice > 0" class="bulk-total">{{ formatPrice(totalPrice) }}</span>
                    <span class="icon arrow-right" />
                </button>
            </div>
        </template>
        <template v-else-if="single">
            <SingleProductList v-if="products.length > 1" v-model="selectedProductId" :webshop="webshop" :cart="checkout.cart" :title="listTitle" />

            <div class="style-button-bar">
                <button type="button" class="button primary full" data-testid="single-order-button" @click="openSelectedProduct">
                    <span>{{ orderButtonText }}</span>
                    <span class="icon arrow-right" />
                </button>
            </div>
        </template>
        <div v-else class="products">
            <CategoryBox v-for="(category, index) in categories" :key="category.id" :category="category" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :is-last="index === categories.length - 1" />
            <div v-if="categories.length === 0" class="container">
                <h2 v-if="listTitle" class="larger">
                    {{ listTitle }}
                </h2>
                <ProductGrid :products="products" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" />
            </div>
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
     * The title above the products when there are no categories (empty: no title)
     */
    listTitle?: string;
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
const hasUnits = computed(() => props.checkout.cart.count > 0);

const single = computed(() => props.webshop.orderMode === WebshopOrderMode.Single);

// Starts at the product of an earlier visit: in single mode the cart only holds the item of the chosen product
const selectedProductId = ref<string | null>(props.checkout.cart.items.find(i => props.products.some(p => p.id === i.product.id))?.product.id ?? null);

function openSelectedProduct() {
    // The choice of an earlier visit can no longer be orderable (e.g. sold out): its radio is disabled
    const product = props.products.length === 1 ? props.products[0] : props.products.find(p => p.id === selectedProductId.value && canOrderProduct(p));
    if (!product) {
        Toast.warning($t('%Zzb')).show();
        return;
    }
    emit('openSingleProduct', product);
}
// In single mode the amount is chosen after this button
const orderButtonText = computed(() => getOrderButtonText(props.webshop, bulk.value ? totalPrice.value : undefined));
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.webshop-products {
    // Once a unit is chosen, the order button sticks to the bottom of the screen like the cart button of a webshop with a cart.
    // The space below the stuck button is an overlay instead of padding: the spacing in the page stays the same, so nothing moves when the first unit is chosen.
    // It only hides the products scrolling below it: it is cut off right below the products (with room for the focus ring of the button),
    // and the platform footer that can start within that room is shown above it (see WebshopPlatformFooter).
    &.with-sticky-order-bar {
        clip-path: inset(-100vh -100vw -4px -100vw);
    }

    .bulk-order-bar.sticky {
        position: sticky;
        bottom: calc(15px + var(--st-safe-area-bottom, 0px));
        z-index: 1;
        background: $color-current-background;

        &::after {
            content: '';
            position: absolute;
            z-index: -1;
            top: 100%;
            left: 0;
            right: 0;
            height: calc(15px + var(--st-safe-area-bottom, 0px));
            background: $color-current-background;
        }
    }

    .bulk-total {
        opacity: 0.7;
        padding-left: 5px;
    }
}
</style>
