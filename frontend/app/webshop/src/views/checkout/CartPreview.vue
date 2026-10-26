<template>
    <div class="cart-preview container" data-testid="cart-preview">
        <h2 class="larger">
            {{ title }}
        </h2>

        <STList>
            <CartItemRow v-for="cartItem of checkout.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="checkout.cart" :webshop="webshop" :editable="false" :admin="false" />
        </STList>

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
}>(), {
    withCustomer: false,
});

const checkoutManager = useCheckoutManager();
const webshopManager = useWebshopManager();
const checkout = computed(() => checkoutManager.checkout);
const customer = computed(() => checkoutManager.checkout.customer);
const webshop = computed(() => webshopManager.webshop);

const cartKind = useCartKind();

// Follows the naming of the order view (OrderView.vue)
const title = computed(() => {
    const texts: Record<CartKind, string> = {
        donation: $t('%eP'),
        ticket: $t('%YC'),
        tickets: $t('%YD'),
        registration: $t('%ZkZ'),
        registrations: $t('Jouw inschrijvingen'),
        order: $t('%Y6'),
    };
    return texts[cartKind.value];
});
</script>
