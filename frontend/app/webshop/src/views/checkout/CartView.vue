<template>
    <div class="st-view cart-view">
        <STNavigationBar :title="title" />
        <main class="flex">
            <h1 class="style-navigation-title">
                {{ title }}
            </h1>

            <p v-if="cart.items.length === 0" class="info-box">
                {{ $t('a6862509-523b-4b07-bbd7-6bfba863874e') }}
            </p>

            <p v-for="code of checkout.discountCodes" :key="code.id" class="discount-box icon label">
                <span>{{ $t('46a3962f-7d21-4cf4-b3a9-bfec8007e68a') }} <span class="style-discount-code">{{ code.code }}</span></span>

                <button class="button icon trash" type="button" @click="deleteCode(code)" />
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList>
                <CartItemRow v-for="cartItem of cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="cart" :webshop="webshop" :editable="true" :admin="false" @edit="editCartItem(cartItem)" @delete="deleteItem(cartItem)" @amount="setCartItemAmount(cartItem, $event)" />
            </STList>

            <AddDiscountCodeBox v-if="webshop.meta.allowDiscountCodeEntry" :apply-code="applyCode" />
            <PriceBreakdownBox :price-breakdown="checkout.priceBreakown" />
        </main>

        <STToolbar>
            <template #right>
                <button type="button" class="button secundary" @click="() => pop()">
                    <span class="icon add" />
                    <span v-if="cart.items.length > 0">{{ $t('95136eb9-934d-4188-b3a9-9a8d4de48dce') }}</span>
                    <span v-else>{{ $t('ab745da8-a058-448a-b81d-2544dd93e4da') }}</span>
                </button>
                <LoadingButton v-if="cart.items.length > 0" :loading="loading">
                    <button class="button primary" type="button" @click="goToCheckout">
                        <span class="icon flag" />
                        <span>{{ $t('a209d3fe-7b1c-43c2-b519-45fb66581201') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AddDiscountCodeBox, CartItemRow, CartItemView, ErrorBox, LoadingButton, PriceBreakdownBox, STErrorsDefault, STList, STNavigationBar, STToolbar, useErrors, useNavigationActions } from '@stamhoofd/components';
import { CartItem, DiscountCode } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';

import { CheckoutStepsManager } from './CheckoutStepsManager';

const title = $t('1259b59f-6447-4da8-887e-848f05da346f');
const loading = ref(false);

const errors = useErrors();
const present = usePresent();
const pop = usePop();

const checkoutManager = useCheckoutManager();
const webshopManager = useWebshopManager();
const navigationActions = useNavigationActions();
const cart = computed(() => checkoutManager.cart);
const checkout = computed(() => checkoutManager.checkout);
const webshop = computed(() => webshopManager.webshop);

async function goToCheckout() {
    if (loading.value) {
        return;
    }

    loading.value = true;
    errors.errorBox = null;

    try {
        await CheckoutStepsManager.for(checkoutManager).goNext(undefined, navigationActions);
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

function deleteCode(code: DiscountCode) {
    checkoutManager.removeCode(code);
}

function deleteItem(cartItem: CartItem) {
    checkoutManager.cart.removeItem(cartItem);
    checkoutManager.checkout.update(webshop.value);
    checkoutManager.saveCart();
}

function setCartItemAmount(cartItem: CartItem, amount: number) {
    cartItem.amount = amount;
    checkoutManager.checkout.update(webshop.value);
    checkoutManager.saveCart();
}

async function applyCode(code: string) {
    return await checkoutManager.applyCode(code);
}

function editCartItem(cartItem: CartItem) {
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(CartItemView, {
                    cartItem: cartItem.clone(),
                    oldItem: cartItem,
                    cart: checkoutManager.cart,
                    webshop: webshopManager.webshop,
                    checkout: checkoutManager.checkout,
                    saveHandler: (cartItem: CartItem, oldItem: CartItem | null, component: any) => {
                        component?.dismiss({ force: true });
                        if (oldItem) {
                            checkoutManager.cart.replaceItem(oldItem, cartItem);
                        }
                        else {
                            checkoutManager.cart.addItem(cartItem);
                        }
                        errors.errorBox = null;
                        checkoutManager.saveCart();
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

onMounted(() => {
    check().catch(console.error);
});

async function check() {
    try {
        await webshopManager.reload();
    }
    catch (e) {
        // Possible: but don't skip validation
        console.error(e);
    }

    try {
        cart.value.validate(webshopManager.webshop);
        errors.errorBox = null;
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }
    checkoutManager.saveCart();

    try {
        await checkoutManager.validateCodes();
    }
    catch (e) {
        console.error(e);
    }
}

function activated() {
    errors.errorBox = null;
    check().catch(console.error);
}

activated();
</script>
