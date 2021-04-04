<template>
    <div class="st-view boxed">
        <STNavigationBar :title="needsPay ? 'Betaalmethode' : 'Bevestigen'">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>
        <div class="box">
            <main v-if="needsPay">
                <h1>Kies een betaalmethode</h1>
                <p>Te betalen: 
                    <span class="style-tag">{{ cart.price | price }}</span>
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
                <span slot="left">Totaal: {{ cart.price | price }}</span>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary" @click="goNext">
                        <span v-if="needsPay && selectedPaymentMethod == 'Transfer'">Inschrijving bevestigen</span>
                        <span v-else-if="needsPay">Betalen</span>
                        <span v-else>Doorgaan</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage,ErrorBox, LoadingButton, PaymentHandler, PaymentSelectionList,Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { KeychainedResponse, Payment, PaymentMethod, RegisterResponse } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from '../../classes/OrganizationManager';
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
    MemberManager = MemberManager
    OrganizationManager = OrganizationManager
    CheckoutManager = CheckoutManager

    loading = false
    errorBox: ErrorBox | null = null

    mounted() {
        this.recalculate()
    }

    get selectedPaymentMethod() {
        return CheckoutManager.checkout.paymentMethod
    }

    set selectedPaymentMethod(paymentMethod: PaymentMethod) {
        CheckoutManager.checkout.paymentMethod = paymentMethod
        CheckoutManager.saveCheckout()
    }

    get paymentMethods() {
        return OrganizationManager.organization.meta.paymentMethods
    }

    get needsPay() {
        // Todo: also check zero prices here
        return this.CheckoutManager.cart.items.find(i => !i.waitingList)
    }

    get organization() {
        return this.OrganizationManager.organization
    }

    async goNext() {
        if (this.loading || (this.selectedPaymentMethod === PaymentMethod.Unknown && this.needsPay)) {
            return
        }
        const session = SessionManager.currentSession!
        this.loading = true

        try {
            const response = await session.authenticatedServer.request({
                method: "POST",
                path: "/members/register",
                body: CheckoutManager.checkout.convert(),
                decoder: RegisterResponse as Decoder<RegisterResponse>
            })

            const payment = response.data.payment
            const registrations = await MemberManager.decryptRegistrationsWithMember(response.data.registrations, OrganizationManager.organization.groups)
            await MemberManager.setMembers(new KeychainedResponse({ data: response.data.members, keychainItems: []}))

            if (payment) {
                PaymentHandler.handlePayment({
                    server: session.authenticatedServer, 
                    organization: OrganizationManager.organization, 
                    payment, 
                    paymentUrl: response.data.paymentUrl, 
                    returnUrl: "https://"+window.location.hostname+"/payment?id="+encodeURIComponent(payment.id),
                    component: this,
                    transferSettings: OrganizationManager.organization.meta.transferSettings,
                    additionalReference: Formatter.uniqueArray(this.CheckoutManager.checkout.cart.items.map(r => r.member.details.lastName)).join(", "),
                    type: "registration"
                }, (payment: Payment) => {
                    // success
                    this.loading = false

                    this.navigationController!.push(new ComponentWithProperties(RegistrationSuccessView, {
                        registrations
                    }), true, this.navigationController!.components.length)
                }, (payment: Payment) => {
                    console.log(payment)
                    // failure
                    this.loading = false
                })
                return;
            }

            this.loading = false
            
            this.navigationController!.push(new ComponentWithProperties(RegistrationSuccessView, {
                registrations
            }), true, this.navigationController!.components.length)
            
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.loading = false
        }
    }

    get cart() {
        return this.CheckoutManager.cart
    }

    recalculate() {
        try {
            this.cart.validate(MemberManager.members ?? [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)
            this.errorBox = null
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        try {
            this.cart.calculatePrices(MemberManager.members ?? [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)
        } catch (e) {
            // error in calculation!
            console.error(e)
        }
        CheckoutManager.saveCart()
    }
}
</script>