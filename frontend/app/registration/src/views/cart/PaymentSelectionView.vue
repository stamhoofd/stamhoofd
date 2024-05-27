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
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, useNavigationController, useShow } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, PaymentHandler, PaymentSelectionList, STErrorsDefault, STNavigationBar, STToolbar, useContext, useErrors, useNavigationActions } from "@stamhoofd/components";
import { Payment, PaymentStatus, RegisterResponse } from "@stamhoofd/structures";
import { computed, onMounted, ref } from "vue";
import { useMemberManager } from "../../getRootView";
import RegistrationSuccessView from "./RegistrationSuccessView.vue";

const memberManager = useMemberManager();
const errors = useErrors();

const checkout = computed(() => memberManager.family.checkout)
const organization = computed(() => checkout.value.singleOrganization)
const loading = ref(false)
const needsPay = computed(() => checkout.value.totalPrice > 0)
const context = useContext()
const show = useShow();
const navigationController = useNavigationController()
const navigate = useNavigationActions()

const selectedPaymentMethod = computed({
    get: () => checkout.value.paymentMethod,
    set: (value) => checkout.value.paymentMethod = value
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
        const organization = checkout.value.singleOrganization!
        const server = context.value.getAuthenticatedServerForOrganization(organization.id)
        const response = await server.request({
            method: "POST",
            path: "/members/register",
            body: checkout.value.convert(),
            decoder: RegisterResponse as Decoder<RegisterResponse>,
            shouldRetry: false
        })
        
        const payment = response.data.payment
        const registrations = response.data.registrations
        memberManager.family.insertFromBlob(response.data.members)

        if (payment && payment.status !== PaymentStatus.Succeeded) {
            await PaymentHandler.handlePayment({
                server, 
                organization: checkout.value.singleOrganization!, 
                payment, 
                paymentUrl: response.data.paymentUrl, 
                navigate,
                transferSettings: checkout.value.singleOrganization!.meta.registrationPaymentConfiguration.transferSettings,
                type: "registration"
            }, () => {
                navigationController.value.push({
                    components: [
                        new ComponentWithProperties(RegistrationSuccessView, {
                            registrations
                        })
                    ], 
                    replace: navigationController.value.components.length, 
                    force: true
                }).catch(console.error)

            }, () => {
                console.log(payment)
            }, () => {
                checkout.value.clear()
            })
            return;
        }

        checkout.value.clear()
        await show({
            components: [
                new ComponentWithProperties(RegistrationSuccessView, {
                    registrations
                })
            ], 
            replace: navigationController.value.components.length, 
        })
       
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    } finally {
        loading.value = false
    }
}
</script>
