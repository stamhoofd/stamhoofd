<template>
    <div class="st-view">
        <STNavigationBar :title="needsPay ? 'Betaalmethode' : 'Bevestigen'" />
        <main v-if="needsPay" class="center">
            <h1>Kies een betaalmethode</h1>
            <p>
                <span>Te betalen: </span>
                <span class="style-tag">{{ formatPrice(checkout.totalPrice) }}</span>
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <PaymentSelectionList v-model="selectedPaymentMethod" :payment-methods="paymentMethods" :organization="organization" />
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
                        <span v-if="needsPay && (selectedPaymentMethod == 'Transfer' || selectedPaymentMethod == 'PointOfSale')">Bevestigen</span>
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
import { LoadingButton, PaymentSelectionList, STErrorsDefault, STNavigationBar, STToolbar, useErrors } from "@stamhoofd/components";
import { computed, ref } from "vue";
import { useMemberManager } from "../../getRootView";

const memberManager = useMemberManager();
const errors = useErrors();

const checkout = computed(() => memberManager.family.checkout)
const organization = computed(() => checkout.value.singleOrganization)
const loading = ref(false)
const needsPay = computed(() => checkout.value.totalPrice > 0)

const selectedPaymentMethod = computed({
    get: () => checkout.value.paymentMethod,
    set: (value) => checkout.value.paymentMethod = value
})

const paymentMethods = computed(() => organization.value?.meta.registrationPaymentConfiguration.paymentMethods ?? [])

function goNext() {
    // todo
}
</script>
