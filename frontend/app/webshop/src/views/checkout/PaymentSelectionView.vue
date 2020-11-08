<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Kies je betaalmethode</h1>

                <STErrorsDefault :error-box="errorBox" />

                <PaymentSelectionList v-model="selectedPaymentMethod" :payment-methods="paymentMethods" :organization="organization" />
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
import { ComponentWithProperties, HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, PaymentHandler,PaymentSelectionList, Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { OrderData, OrderResponse, Payment, PaymentMethod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import OrderView from '../orders/OrderView.vue';
import { CheckoutStepType } from './CheckoutStepsManager';

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
        this.navigationController!.push(new ComponentWithProperties(OrderView, { orderId: id, success: true }))
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
            if (payment) {
                PaymentHandler.handlePayment({
                    server: WebshopManager.server, 
                    organization: this.organization, 
                    payment, 
                    paymentUrl: response.data.paymentUrl, 
                    component: this
                }, (payment: Payment) => {
                    console.log("Success")
                    // success
                    this.loading = false
                    this.goToOrder(response.data.order.id)
                }, (payment: Payment) => {
                    console.log(payment)
                    // failure
                    this.loading = false
                })
                return;
            }

            // Go to success page
            this.show(new ComponentWithProperties(OrderView, { initialOrder: response.data.order, success: true }))
            
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    activated() {
        HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/checkout/"+CheckoutStepType.Payment.toLowerCase())
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>