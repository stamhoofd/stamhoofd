<template>
    <SaveView :title="title" :loading="loading" save-text="Bestelling bevestigen" :prefer-large-button="true" @save="goNext">
        <template v-if="checkout.totalPrice > 0" #left>
            <span>Totaal: {{ formatPrice(checkout.totalPrice) }}</span>
        </template>

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
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { ErrorBox, LoadingButton, PaymentHandler, PaymentSelectionList, Radio, SaveView, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { I18nController } from '@stamhoofd/frontend-i18n';
import { OrderData, OrderResponse, Payment, PaymentMethod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { CheckoutManager } from '../../classes/CheckoutManager';
import OrderView from '../orders/OrderView.vue';

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
        return this.$checkoutManager.checkout.paymentMethod
    }

    set selectedPaymentMethod(paymentMethod: PaymentMethod | null) {
        this.$checkoutManager.checkout.paymentMethod = paymentMethod
        this.$checkoutManager.saveCheckout()
    }

    get paymentContext() {
        return this.checkout.paymentContext
    }

    get checkout() {
        return this.$checkoutManager.checkout
    }

    get checkoutMethod() {
        return this.$checkoutManager.checkout.checkoutMethod!
    }

    get webshop() {
        return this.$webshopManager.webshop
    }

    get isTrial() {
        return this.organization.meta.packages.isWebshopsTrial
    }

    get organization() {
        return this.$webshopManager.organization
    }

    get paymentMethods() {
        return this.webshop.meta.paymentMethods
    }

    goToOrder(id: string, component: NavigationMixin) {
        // Force reload webshop (stock will have changed: prevent invalidating the cart)
        // Update stock in background
        this.$webshopManager.reload().catch(e => {
            console.error(e)
        })
        
        if (!this.popup) {
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
            component.dismiss({force: true})
            component.present({
                components: [
                    new ComponentWithProperties(OrderView, { orderId: id, success: true })
                ]
            })
        }
    }
   
    async goNext() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            if (!this.$checkoutManager.checkout.paymentMethod) {
                this.$checkoutManager.checkout.paymentMethod = PaymentMethod.Unknown
            }
            // Place order
            const data = OrderData.create(this.$checkoutManager.checkout as any)
            data.consumerLanguage = I18nController.shared?.language ?? "nl"
            const response = await this.$webshopManager.optionalAuthenticatedServer.request({
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
                    server: this.$webshopManager.server, 
                    organization: this.organization, 
                    payment, 
                    paymentUrl: response.data.paymentUrl, 
                    returnUrl: "https://"+this.webshop.getUrl(this.organization)+"/payment?id="+encodeURIComponent(payment.id),
                    component: this,
                    transferSettings: this.$webshopManager.webshop.meta.transferSettings,
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
                    await this.$webshopManager.reload()
                    
                    if (this.webshop.meta.cartEnabled) {
                        this.navigationController!.popToRoot({ force: true }).catch(e => console.error(e))
                    } else {
                        this.dismiss({ force: true })
                    }
                    Toast.fromError(e).show()
                } else if (error.hasFieldThatStartsWith("fieldAnswers")) {
                    // A cart error: force a reload and go back to the cart.
                    await this.$webshopManager.reload()

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
}
</script>

