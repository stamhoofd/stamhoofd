<template>
    <div class="st-view">
        <STNavigationBar :title="needsPay ? $t(`d880e10c-63f5-4a84-a994-97bbfcb04f4f`) : $t(`Bevestigen`)"/>
        <main v-if="needsPay" class="center">
            <h1>{{ $t('ac889a25-4ace-416a-b82d-544881eab46a') }}</h1>

            <STErrorsDefault :error-box="errors.errorBox"/>

            <PaymentSelectionList v-model="selectedPaymentMethod" :payment-configuration="paymentConfiguration" :amount="checkout.totalPrice" :customer="checkout.customer" :organization="organization"/>

            <PriceBreakdownBox :price-breakdown="checkout.priceBreakown"/>
        </main>
        <main v-else class="center">
            <h1>{{ $t('d7d0ab80-9321-49a2-b050-cf8f3c23640e') }}</h1>
            <p>{{ $t('6292ce9e-a57a-4f8f-be04-4d9e17497b2c') }}</p>

            <STErrorsDefault :error-box="errors.errorBox"/>
        </main>

        <STToolbar>
            <template #left>
                <span>{{ $t('6cbde4da-3770-4726-8ea4-9a53b785a66e') }} {{ formatPrice(checkout.totalPrice) }}</span>
            </template>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="goNext">
                        <span v-if="needsPay && (selectedPaymentMethod === 'Transfer' || selectedPaymentMethod === 'PointOfSale')">{{ $t('da58ee7b-f99e-448b-9acc-37f7df4f9f26') }}</span>
                        <span v-else-if="needsPay">{{ $t('627c742f-ce38-4b13-be64-314727b98608') }}</span>
                        <span v-else>{{ $t('da58ee7b-f99e-448b-9acc-37f7df4f9f26') }}</span>
                        <span class="icon arrow-right"/>
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

const organization = computed(() => props.checkout.singleOrganization);
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
