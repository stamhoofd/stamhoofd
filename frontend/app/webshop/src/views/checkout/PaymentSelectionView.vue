<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Kies je betaalmethode</h1>

                <STErrorsDefault :error-box="errorBox" />

                <PaymentSelectionList :payment-methods="paymentMethods" :organization="organization" v-model="selectedPaymentMethod" />
            </main>

            <STToolbar>
                <LoadingButton slot="right" :loading="loading">
                    <button class="button primary" @click="goNext">
                        <span>Doorgaan</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar, PaymentSelectionList, PaymentHandler } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { Group, KeychainedResponse, MemberWithRegistrations, OrderData, OrderResponse, Payment, PaymentMethod, PaymentStatus, Record, RecordType, RegisterMember, RegisterMembers, RegisterResponse, SelectedGroup, WebshopTakeoutMethod, WebshopTimeSlot, WebshopTimeSlots } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop,Vue } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import MemberGeneralView from '../registration/MemberGeneralView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        PaymentSelectionList
    },
    filters: {
        dateWithDay: (d: Date) => Formatter.capitalizeFirstLetter(Formatter.dateWithDay(d)),
        minutes: Formatter.minutes.bind(Formatter)
    }
})
export default class PaymentSelectionView extends Mixins(NavigationMixin){
    step = -1

    loading = false
    errorBox: ErrorBox | null = null
    CheckoutManager = CheckoutManager

    get selectedPaymentMethod(): PaymentMethod | null {
        return CheckoutManager.checkout.paymentMethod
    }

    set selectedPaymentMethod(paymentMethod: PaymentMethod | null) {
        CheckoutManager.checkout.paymentMethod = paymentMethod
        CheckoutManager.saveCheckout()
    }

    get checkoutMethod() {
        return CheckoutManager.checkout.checkoutMethod!
    }

    get webshop() {
        return WebshopManager.webshop
    }

    get organization() {
       return WebshopManager.organization
    }

    get paymentMethods() {
        return this.organization.meta.paymentMethods // todo: replace by webshop payment methods in the future
    }

    goToOrder(id: string) {

    }
   
    async goNext() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
           // Place order
           const response = await WebshopManager.server.request({
                method: "POST",
                path: "/webshop/"+this.webshop.id+"/order",
                body: OrderData.create(CheckoutManager.checkout as any), // todo: add some manual casting here
                decoder: OrderResponse as Decoder<OrderResponse>
            })

            const payment = response.data.order.payment
            if (payment && response.data.paymentUrl) {
                PaymentHandler.handlePayment(WebshopManager.server, payment, response.data.paymentUrl, this, (payment: Payment) => {
                    // success
                    this.loading = false
                    this.goToOrder(response.data.order.id)
                }, (payment: Payment) => {
                    // failure
                    this.loading = false
                })
                return;
            }

            // todo
            
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>