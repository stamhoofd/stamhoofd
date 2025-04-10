<template>
    <div class="st-view">
        <STNavigationBar :title="needsPay ? $t(`Betaalmethode`) : $t(`Bevestigen`)" />
        <main v-if="needsPay" class="center">
            <h1>{{ $t('Kies een betaalmethode') }}</h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <PaymentSelectionList v-model="selectedPaymentMethod" :payment-configuration="paymentConfiguration" :amount="checkout.totalPrice" :customer="checkout.customer" :organization="organization" />

            <PriceBreakdownBox :price-breakdown="checkout.priceBreakown" />
        </main>
        <main v-else class="center">
            <h1>{{ $t('Bevestig je inschrijvingen') }}</h1>
            <p>{{ $t('Heb je alle inschrijvingen toegevoegd aan je mandje? Je kan meerdere inschrijvingen in één keer afrekenen.') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />
        </main>

        <STToolbar>
            <template #left>
                <span>{{ $t('Totaal') }}: {{ formatPrice(checkout.totalPrice) }}</span>
            </template>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="goNext">
                        <span v-if="needsPay && (selectedPaymentMethod === 'Transfer' || selectedPaymentMethod === 'PointOfSale')">{{ $t('Bevestigen') }}</span>
                        <span v-else-if="needsPay">{{ $t('Betalen') }}</span>
                        <span v-else>{{ $t('Bevestigen') }}</span>
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
