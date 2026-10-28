<template>
    <div class="cart-preview container" data-testid="cart-preview">
        <h2 class="larger">
            {{ title }}
        </h2>

        <STList>
            <CartItemRow v-for="cartItem of groupedCheckout.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="groupedCheckout.cart" :webshop="webshop" :editable="false" :admin="false" />
        </STList>

        <template v-if="withDiscountCodes">
            <p v-for="code of checkout.discountCodes" :key="code.id" class="discount-box icon label">
                <span>{{ $t('%1MX') }} <span class="style-discount-code">{{ code.code }}</span></span>

                <button class="button icon trash" type="button" @click="checkoutManager.removeCode(code)" />
            </p>

            <AddDiscountCodeBox v-if="webshop.meta.allowDiscountCodeEntry" :apply-code="code => checkoutManager.applyCode(code)" />
        </template>

        <PriceBreakdownBox v-if="checkout.totalPrice || !webshop.isAllFree" :price-breakdown="checkout.priceBreakown" />

        <template v-if="withCustomer">
            <hr>
            <h3 class="larger">
                {{ $t('%ZlW') }}
            </h3>
            <STList class="info" data-testid="cart-preview-customer">
                <STListItem v-if="customer.name">
                    <h3 class="style-definition-label">
                        {{ $t('%1Os') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ customer.name }}
                    </p>
                </STListItem>
                <STListItem v-if="customer.email">
                    <h3 class="style-definition-label">
                        {{ $t('%1FK') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ customer.email }}
                    </p>
                </STListItem>
                <STListItem v-if="customer.phone">
                    <h3 class="style-definition-label">
                        {{ $t('%wD') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ customer.phone }}
                    </p>
                </STListItem>
            </STList>
        </template>
    </div>
</template>

<script lang="ts" setup>
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import AddDiscountCodeBox from '@stamhoofd/components/views/AddDiscountCodeBox.vue';
import CartItemRow from '@stamhoofd/components/views/CartItemRow.vue';
import PriceBreakdownBox from '@stamhoofd/components/views/PriceBreakdownBox.vue';
import { computed } from 'vue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import type { CartKind } from './useCartKind';
import { useCartKind } from './useCartKind';

withDefaults(defineProps<{
    /**
     * Also show the contact details of the customer, once they are filled in
     */
    withCustomer?: boolean;
    /**
     * Show the applied discount codes, and a box to enter one when the webshop allows it
     */
    withDiscountCodes?: boolean;
}>(), {
    withCustomer: false,
    withDiscountCodes: false,
});

const checkoutManager = useCheckoutManager();
const webshopManager = useWebshopManager();
const checkout = computed(() => checkoutManager.checkout);
const customer = computed(() => checkoutManager.checkout.customer);
const webshop = computed(() => webshopManager.webshop);
// Like the order: the units of the bulk order mode with the same choices are shown as one item
const groupedCheckout = computed(() => checkout.value.withGroupedItems(webshop.value));

const cartKind = useCartKind();

// Follows the naming of the order view (OrderView.vue)
const title = computed(() => {
    const texts: Record<CartKind, string> = {
        donation: $t('%eP'),
        ticket: $t('%YC'),
        tickets: $t('%YD'),
        registration: $t('%ZkZ'),
        registrations: $t('%a0E'),
        order: $t('%Y6'),
    };
    return texts[cartKind.value];
});
</script>
