<template>
    <div class="st-view" data-testid="payment-selection-view">
        <STNavigationBar :title="needsPay ? $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`) : $t(`84dc69fb-179d-4e25-a5c8-4a6beb57bcdd`)" />
        <main v-if="needsPay" class="center">
            <h1>{{ $t('6f2975aa-d60f-4abb-b597-c30e2382da12') }}</h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <PaymentSelectionList v-model="selectedPaymentMethod" :payment-configuration="paymentConfiguration" :amount="checkout.totalPrice" :customer="checkout.customer" :organization="organization" />

            <PriceBreakdownBox :price-breakdown="checkout.priceBreakown" />
        </main>
        <main v-else class="center">
            <h1>{{ $t('3127d046-5f3e-45fa-bf28-bc5e3a227773') }}</h1>
            <p>{{ $t('2e8bad7e-ff47-4ea1-b38d-4f4e24153146') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />
        </main>

        <STToolbar>
            <template #left>
                <span data-testid="total-text">{{ $t('e67d0122-6f15-46c6-af94-92a79268710a') }}: {{ formatPrice(checkout.totalPrice) }}</span>
            </template>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" data-testid="confirm-payment-method-button" @click="goNext">
                        <span v-if="needsPay && (selectedPaymentMethod === 'Transfer' || selectedPaymentMethod === 'PointOfSale')">{{ $t('7de2e636-dcec-44b1-a681-daeb9cd85316') }}</span>
                        <span v-else-if="needsPay">{{ $t('e3f37ccd-a27c-4455-96f4-e33b74ae879e') }}</span>
                        <span v-else>{{ $t('7de2e636-dcec-44b1-a681-daeb9cd85316') }}</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ErrorBox, LoadingButton, NavigationActions, PaymentSelectionList, PriceBreakdownBox, STErrorsDefault, STNavigationBar, STToolbar, useErrors, useNavigationActions } from '@stamhoofd/components';
import { RegisterCheckout } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{
    checkout: RegisterCheckout;
    saveHandler: (navigate: NavigationActions) => Promise<void>;
}>();

const errors = useErrors();

const organization = computed(() => props.checkout.singleOrganization!);
const loading = ref(false);
const needsPay = computed(() => props.checkout.totalPrice > 0);
const navigate = useNavigationActions();

const selectedPaymentMethod = computed({
    get: () => props.checkout.paymentMethod,
    set: value => props.checkout.paymentMethod = value,
});

onMounted(() => {
    if (!needsPay.value) {
        selectedPaymentMethod.value = null;
        return;
    }
    if (!selectedPaymentMethod.value && paymentMethods.value.length) {
        selectedPaymentMethod.value = paymentMethods.value[0];
    }
});

const paymentMethods = computed(() => organization.value?.meta.registrationPaymentConfiguration.getAvailablePaymentMethods({
    amount: props.checkout.totalPrice,
    customer: props.checkout.customer,
}) ?? []);

const paymentConfiguration = computed(() => organization.value!.meta.registrationPaymentConfiguration);

async function goNext() {
    if (loading.value) {
        return;
    }

    loading.value = true;
    errors.errorBox = null;

    try {
        await props.saveHandler(navigate);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loading.value = false;
    }
}
</script>
