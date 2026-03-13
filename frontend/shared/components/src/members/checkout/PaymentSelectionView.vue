<template>
    <div class="st-view" data-testid="payment-selection-view">
        <STNavigationBar :title="needsPay ? $t(`%M7`) : $t(`%X9`)" />
        <main v-if="needsPay" class="center">
            <h1>{{ $t('%eU') }}</h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <PaymentSelectionList v-model="selectedPaymentMethod" :payment-configuration="paymentConfiguration" :amount="checkout.totalPrice" :customer="checkout.customer" :organization="organization" />

            <PriceBreakdownBox :price-breakdown="checkout.priceBreakown" />
        </main>
        <main v-else class="center">
            <h1>{{ $t('%eV') }}</h1>
            <p>{{ $t('%eW') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />
        </main>

        <STToolbar>
            <template #left>
                <span data-testid="total-text">{{ $t('%xL') }}: {{ formatPrice(checkout.totalPrice) }}</span>
            </template>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" data-testid="confirm-payment-method-button" @click="goNext">
                        <span v-if="needsPay && (selectedPaymentMethod === 'Transfer' || selectedPaymentMethod === 'PointOfSale')">{{ $t('%X9') }}</span>
                        <span v-else-if="needsPay">{{ $t('%eX') }}</span>
                        <span v-else>{{ $t('%X9') }}</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ErrorBox } from '#errors/ErrorBox.ts';
import LoadingButton from '#navigation/LoadingButton.vue';
import type { NavigationActions } from '#types/NavigationActions.ts';
import PaymentSelectionList from '#views/PaymentSelectionList.vue';
import PriceBreakdownBox from '#views/PriceBreakdownBox.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
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
