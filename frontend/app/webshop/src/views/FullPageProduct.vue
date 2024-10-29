<template>
    <div class="full-product-box">
        <CartItemView v-if="cartItem" :cart-item="cartItem" :checkout="checkout" :save-handler="mappedSaveHandler" :webshop="webshop" :old-item="oldItem" :admin="admin" />
    </div>
</template>

<script lang="ts" setup>
import { CartItemView } from '@stamhoofd/components';
import { CartItem, Checkout, Product, Webshop } from '@stamhoofd/structures';
import { computed, Ref, ref } from 'vue';

const props = withDefaults(defineProps<{
    admin?: boolean;
    product: Product;
    webshop: Webshop;
    checkout: Checkout;
    saveHandler: (newItem: CartItem, oldItem: CartItem | null, component: any) => void;
}>(), {
    admin: false,

});

const cartItem = ref<CartItem | null>(null) as Ref<CartItem | null>;

const cart = computed(() => props.checkout.cart);
const updateItem = computed(() => !props.webshop.shouldEnableCart || props.product.isUnique);
const oldItem = computed(() => {
    if (updateItem.value) {
        const item = cart.value.items.find(i => i.product.id === props.product.id);
        if (item) {
            try {
                item.validate(props.webshop, cart.value, {
                    refresh: true,
                    admin: props.admin,
                });

                return item;
            }
            catch (e) {
                console.error(e);
            }
        }
    }

    return null;
});

function created() {
    // Validate the cart item once
    if (!oldItem.value && !props.webshop.shouldEnableCart) {
        // Otherwie we are not able to remove the invalid items
        cart.value.clear();
    }
    cartItem.value = getCartItem();
}

created();

function getCartItem() {
    if (oldItem.value) {
        return oldItem.value.clone();
    }

    return CartItem.createDefault(props.product, cart.value, props.webshop, { admin: props.admin });
}

function mappedSaveHandler(newItem: CartItem, oldItem: CartItem | null, component: any) {
    props.saveHandler(newItem, oldItem, component.canDismiss ? component : null); // no component dismiss

    // Clear the cart item if needed
    cartItem.value = getCartItem();
}
</script>
