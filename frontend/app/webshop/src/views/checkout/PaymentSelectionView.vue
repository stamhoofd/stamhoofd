<template>
    <SaveView :title="title" :loading="loading" save-text="Bestelling bevestigen" :prefer-large-button="true" @save="goNext">
        <span slot="left">Totaal: {{ checkout.totalPrice | price }}</span>

        <h1>{{ title }}</h1>

        <p v-if="isTrial" class="warning-box">
            Dit is een demo webshop. Bestellingen zijn fictief.
        </p>

        <template v-if="checkout.totalPrice > 0">
            <STErrorsDefault :error-box="errorBox" />
            <PaymentSelectionList v-model="selectedPaymentMethod" :payment-methods="paymentMethods" :organization="organization" :context="paymentContext" />
        </template>
        <template v-else>
            <p>Jouw bestelling zal worden geplaatst als je verder gaat.</p>
            <STErrorsDefault :error-box="errorBox" />
        </template>
    </SaveView>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, PaymentHandler, PaymentSelectionList, Radio, SaveView, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { I18nController } from '@stamhoofd/frontend-i18n';
import { UrlHelper } from '@stamhoofd/networking';
import { OrderData, OrderResponse, Payment, PaymentMethod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import OrderView from '../orders/OrderView.vue';
import CartView from './CartView.vue';
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
        PaymentSelectionList,
        SaveView
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        dateWithDay: (d: Date) => Formatter.capitalizeFirstLetter(Formatter.dateWithDay(d)),
        minutes: Formatter.minutes.bind(Formatter)
    }
})
export default class PaymentSelectionView extends Mixins(NavigationMixin){
    step = -1

    loading = false
    errorBox: ErrorBox | null = null
    CheckoutManager = CheckoutManager

    get title() {
        if (this.checkout.totalPrice > 0) {
            return "Kies je betaalmethode"
        }
        return "Bevestig jouw bestelling"
    }

    get selectedPaymentMethod(): PaymentMethod | null {
        return CheckoutManager.checkout.paymentMethod
    }

    set selectedPaymentMethod(paymentMethod: PaymentMethod | null) {
        CheckoutManager.checkout.paymentMethod = paymentMethod
        CheckoutManager.saveCheckout()
    }

    get paymentContext() {
        return this.checkout.paymentContext
    }

    get checkout() {
        return CheckoutManager.checkout
    }

    get checkoutMethod() {
        return CheckoutManager.checkout.checkoutMethod!
    }

    get webshop() {
        return WebshopManager.webshop
    }

    get isTrial() {
        return this.organization.meta.packages.isWebshopsTrial
    }

    get organization() {
        return WebshopManager.organization
    }

    get paymentMethods() {
        return this.webshop.meta.paymentMethods
    }

    goToOrder(id: string, component: NavigationMixin) {
        if (this.modalNavigationController) {
            // We are not in a popup: on mobile
            // So replace with a force instead of dimissing
            component.present({
                components: [
                    new ComponentWithProperties(OrderView, { orderId: id, success: true })
                ],
                replace: 1,
                force: true
            })
        } else {
            // Desktop: push
            component.present({
                components: [
                    new ComponentWithProperties(OrderView, { orderId: id, success: true })
                ]
            })
            component.dismiss({force: true})
        }
    }
   
    async goNext() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            if (!CheckoutManager.checkout.paymentMethod) {
                CheckoutManager.checkout.paymentMethod = PaymentMethod.Unknown
            }
            // Place order
            const data = OrderData.create(CheckoutManager.checkout as any)
            data.consumerLanguage = I18nController.shared?.language ?? "nl"
            const response = await WebshopManager.server.request({
                method: "POST",
                path: "/webshop/"+this.webshop.id+"/order",
                body: data, // TODO: add some manual casting here
                decoder: OrderResponse as Decoder<OrderResponse>,
                shouldRetry: false,
                timeout: 30000 // Longer because some payment providers are slow in development mode
            })

            const payment = response.data.order.payment
            if (payment) {
                PaymentHandler.handlePayment({
                    server: WebshopManager.server, 
                    organization: this.organization, 
                    payment, 
                    paymentUrl: response.data.paymentUrl, 
                    returnUrl: "https://"+this.webshop.getUrl(this.organization)+"/payment?id="+encodeURIComponent(payment.id),
                    component: this,
                    transferSettings: WebshopManager.webshop.meta.transferSettings,
                    type: "order"
                }, (payment: Payment, component: NavigationMixin) => {
                    this.loading = false
                    this.goToOrder(response.data.order.id, component)
                }, (payment: Payment) => {
                    // failure
                    this.loading = false
                })
                return;
            }

            // Go to success page
            this.loading = false
            this.goToOrder(response.data.order.id, this)
            
        } catch (e) {            
            let error = e

            if (isSimpleError(e)) {
                error = new SimpleErrors(e)
            }

            if (isSimpleErrors(error)) {
                if (error.hasFieldThatStartsWith("cart")) {
                    // A cart error: force a reload and go back to the cart.
                    await WebshopManager.reload()
                    
                    if (this.webshop.meta.cartEnabled) {
                        this.navigationController!.popToRoot({ force: true }).catch(e => console.error(e))
                    } else {
                        this.dismiss({ force: true })
                    }
                    Toast.fromError(e).show()
                } else if (error.hasFieldThatStartsWith("fieldAnswers")) {
                    // A cart error: force a reload and go back to the cart.
                    await WebshopManager.reload()

                    if (this.webshop.meta.cartEnabled) {
                        this.navigationController!.popToRoot({ force: true }).catch(e => console.error(e))
                    } else {
                        this.dismiss({ force: true })
                    }

                    Toast.fromError(e).show()
                }


            }
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    mounted() {
        UrlHelper.setUrl("/checkout/"+CheckoutStepType.Payment.toLowerCase())
    }
}
</script>

