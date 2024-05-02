<template>
    <div class="st-view">
        <STNavigationBar :title="needsPay ? 'Betaalmethode' : 'Bevestigen'" />
        <main v-if="needsPay">
            <h1>Kies een betaalmethode</h1>
            <p>
                <span>Te betalen: </span>
                <span class="style-tag">{{ formatPrice(cart.price) }}</span>
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <PaymentSelectionList v-model="selectedPaymentMethod" :payment-methods="paymentMethods" :organization="organization" />
        </main>
        <main v-else>
            <h1>Bevestig je inschrijvingen</h1>
            <p>Heb je alle inschrijvingen toegevoegd aan je mandje? Je kan meerdere inschrijvingen in één keer afrekenen.</p>

            <STErrorsDefault :error-box="errorBox" />
        </main>

        <STToolbar>
            <template #left>
                <span>Totaal: {{ formatPrice(cart.price) }}</span>
            </template>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" type="button" @click="goNext">
                    <span v-if="needsPay && (selectedPaymentMethod == 'Transfer' || selectedPaymentMethod == 'PointOfSale')">Bevestigen</span>
                    <span v-else-if="needsPay">Betalen</span>
                    <span v-else>Bevestigen</span>
                    <span class="icon arrow-right" />
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { BackButton, ErrorBox, LoadingButton, PaymentHandler, PaymentSelectionList, Radio, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { KeychainedResponse, Payment, PaymentMethod, PaymentStatus, RegisterResponse } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';


import RegistrationSuccessView from './RegistrationSuccessView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        PaymentSelectionList,
        BackButton
    },
    filters: {
        price: Formatter.price.bind(Formatter),
    }
})
export default class PaymentSelectionView extends Mixins(NavigationMixin){
    
    

    loading = false
    errorBox: ErrorBox | null = null

    mounted() {
        this.recalculate().catch(console.error)
    }

    get selectedPaymentMethod() {
        return this.$checkoutManager.checkout.paymentMethod
    }

    set selectedPaymentMethod(paymentMethod: PaymentMethod) {
        this.$checkoutManager.checkout.paymentMethod = paymentMethod
        this.$checkoutManager.saveCheckout()
    }

    get paymentMethods() {
        return this.$organization.meta.paymentMethods
    }

    get needsPay() {
        return this.cart.price > 0
    }

    get organization() {
        return this.$organization
    }

    async goNext() {
        if (this.loading || (this.selectedPaymentMethod === PaymentMethod.Unknown && this.needsPay)) {
            return
        }
        this.loading = true

        try {
            const response = await this.$context.authenticatedServer.request({
                method: "POST",
                path: "/members/register",
                body: this.$checkoutManager.checkout.convert(),
                decoder: RegisterResponse as Decoder<RegisterResponse>,
                shouldRetry: false
            })

            const payment = response.data.payment
            const registrations = this.$memberManager.decryptRegistrationsWithMember(response.data.registrations, this.$organization.groups)
            this.$memberManager.setMembers(new KeychainedResponse({ data: response.data.members }))

            if (payment && payment.status !== PaymentStatus.Succeeded) {
                PaymentHandler.handlePayment({
                    server: this.$context.authenticatedServer, 
                    organization: this.$organization, 
                    payment, 
                    paymentUrl: response.data.paymentUrl, 
                    returnUrl: "https://"+window.location.hostname+"/payment?id="+encodeURIComponent(payment.id),
                    component: this,
                    transferSettings: this.$organization.meta.transferSettings,
                    type: "registration"
                }, (payment: Payment) => {
                    // success
                    this.loading = false

                    this.navigationController!.push({
                        components: [
                            new ComponentWithProperties(RegistrationSuccessView, {
                                registrations
                            })
                        ], 
                        replace: this.navigationController?.components.length, 
                        force: true
                    }).catch(console.error)

                }, (payment: Payment) => {
                    console.log(payment)
                    // failure
                    this.loading = false
                }, (payment: Payment) => {
                    // Transfer view opened:
                    // Clear cart
                    this.$checkoutManager.cart.clear()
                    this.$checkoutManager.saveCart()
                })
                return;
            }

            this.loading = false

            this.show({
                components: [
                    new ComponentWithProperties(RegistrationSuccessView, {
                        registrations
                    })
                ], 
                replace: this.navigationController?.components.length, 
            })
            
        } catch (e) {
            console.error(e)
            // Do a force refetch of data
            await this.recalculate(true)

            // Show error
            this.errorBox = new ErrorBox(e)
            this.loading = false
            
        }
    }

    get cart() {
        return this.$checkoutManager.cart
    }

    async recalculate(refetch = false) {
        try {
            await this.$checkoutManager.recalculateCart(refetch)
            this.errorBox = null
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
    }
}
</script>