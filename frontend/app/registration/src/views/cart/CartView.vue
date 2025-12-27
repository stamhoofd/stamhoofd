<template>
    <section class="st-view">
        <STNavigationBar :title="$t(`de716992-0ce7-45a3-b45b-f269d3d17256`)" />
        <main class="center">
            <h1>
                {{ $t('5e2654f2-6423-47bc-b7e7-054e41bf287f') }}
            </h1>

            <p v-if="cart.price">
                {{ $t('18650de1-4791-4334-ac74-2ab6848f9a28') }}
            </p>
            <p v-else>
                {{ $t('00bd2458-2429-41bf-803b-c74a58736265') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <p v-if="cart.isEmpty" class="info-box">
                {{ $t("8def4c64-356c-496f-ad1e-0ecb5b7892a4") }}
            </p>

            <template v-else>
                <STList>
                    <RegisterItemRow v-for="item in cart.items" :key="item.id" class="right-stack" :item="item" />
                    <BalanceItemCartItemRow v-for="item in cart.balanceItems" :key="item.id" class="right-stack" :item="item" :checkout="checkout" />
                </STList>
                <PriceBreakdownBox :price-breakdown="checkout.priceBreakown" />

                <p class="style-button-bar right-align">
                    <LoadingButton :loading="loading">
                        <button class="button primary" type="button" data-testid="go-to-checkout-button" @click="goToCheckout">
                            <span v-if="checkout.totalPrice">{{ $t('c6b88f05-a46b-40cc-895a-8652cd9857f3') }}</span>
                            <span v-else>{{ $t('7de2e636-dcec-44b1-a681-daeb9cd85316') }}</span>

                            <span class="icon arrow-right" />
                        </button>
                    </LoadingButton>
                </p>
            </template>
        </main>
    </section>
</template>

<script setup lang="ts">
import { BalanceItemCartItemRow, ErrorBox, PriceBreakdownBox, RegisterItemRow, startCheckout, useContext, useErrors, useNavigationActions } from '@stamhoofd/components';
import { useMemberManager } from '@stamhoofd/networking';
import { computed, onActivated, onMounted, ref } from 'vue';

const memberManager = useMemberManager();
const checkout = computed(() => memberManager.family.checkout);
const cart = computed(() => checkout.value.cart);
const errors = useErrors();
const context = useContext();
const navigate = useNavigationActions();

const loading = ref(false);

onMounted(() => {
    checkout.value.updatePrices();

    try {
        errors.errorBox = null;
        checkout.value.validate({});
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
});
onActivated(() => {
    checkout.value.updatePrices();
});

async function goToCheckout() {
    if (loading.value) {
        return;
    }

    loading.value = true;
    errors.errorBox = null;

    try {
        await startCheckout({
            admin: false,
            checkout: checkout.value,
            context: context.value,
            displayOptions: { action: 'present', modalDisplayStyle: 'popup' },
        }, navigate);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loading.value = false;
    }
}

</script>
