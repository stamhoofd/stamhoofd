<template>
    <div class="st-view">
        <STNavigationBar :title="needsPay ? 'Betaalmethode' : 'Bevestigen'" />
        <main v-if="needsPay" class="center">
            <h1>Kies een betaalmethode</h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <PaymentSelectionList v-model="selectedPaymentMethod" :payment-methods="paymentMethods" :organization="organization" />

            <PriceBreakdownBox :price-breakdown="checkout.priceBreakown" />
        </main>
        <main v-else class="center">
            <h1>Bevestig je inschrijvingen</h1>
            <p>Heb je alle inschrijvingen toegevoegd aan je mandje? Je kan meerdere inschrijvingen in één keer afrekenen.</p>

            <STErrorsDefault :error-box="errors.errorBox" />
        </main>

        <STToolbar>
            <template #left>
                <span>Totaal: {{ formatPrice(checkout.totalPrice) }}</span>
            </template>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="goNext">
                        <span v-if="needsPay && (selectedPaymentMethod === 'Transfer' || selectedPaymentMethod === 'PointOfSale')">Bevestigen</span>
                        <span v-else-if="needsPay">Betalen</span>
                        <span v-else>Bevestigen</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ErrorBox, LoadingButton, NavigationActions, PaymentSelectionList, PriceBreakdownBox, STErrorsDefault, STNavigationBar, STToolbar, useErrors, useNavigationActions } from "@stamhoofd/components";
import { RegisterCheckout } from "@stamhoofd/structures";
import { computed, onMounted, ref } from "vue";

const props = defineProps<{
    checkout: RegisterCheckout,
    saveHandler: (navigate: NavigationActions) => Promise<void>
}>()

const errors = useErrors();

const organization = computed(() => props.checkout.singleOrganization)
const loading = ref(false)
const needsPay = computed(() => props.checkout.totalPrice > 0)
const navigate = useNavigationActions()

const selectedPaymentMethod = computed({
    get: () => props.checkout.paymentMethod,
    set: (value) => props.checkout.paymentMethod = value
})

onMounted(() => {
    if (!needsPay.value) {
        selectedPaymentMethod.value = null;
        return
    }
    if (!selectedPaymentMethod.value && paymentMethods.value.length) {
        selectedPaymentMethod.value = paymentMethods.value[0]
    }
})

const paymentMethods = computed(() => organization.value?.meta.registrationPaymentConfiguration.paymentMethods ?? [])

async function goNext() {
    if (loading.value) {
        return
    }

    loading.value = true
    errors.errorBox = null

    try {
        await props.saveHandler(navigate)
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    } finally {
        loading.value = false
    }
}
</script>
