<template>
    <LoadingView v-if="!order" />
    <div v-else class="boxed-view">
        <div class="st-view order-view">
            <main>
                <h1 v-if="success">
                    Jouw bestelling is geplaatst
                </h1>
                <h1 v-else>
                    Jouw bestelling
                </h1>

                <p v-if="success">
                    Bedankt voor jouw bestelling, je ontvangt via e-mail ook een bevestiging.
                </p>

                <p v-if="order.payment && order.payment.status != 'Succeeded'" class="warning-box">
                    Opgelet: deze bestelling werd (mogelijks) nog niet betaald. Zorg er zeker voor dat je deze meteen betaald zodat het bedrag op tijd op onze rekening komt.
                </p>

                <STList>
                    <STListItem class="right-description">
                        Naam

                        <template slot="right">
                            {{ order.data.customer.name }}
                        </template>
                    </STListItem>
                    <STListItem v-if="order.payment" class="right-description right-stack" :selectable="order.payment.status != 'Succeeded'" @click="openTransferView">
                        Betaalmethode

                        <template slot="right">
                            {{ order.payment.method }}

                            <span v-if="order.payment.status == 'Succeeded'" class="icon green success" />
                            <span v-else class="icon help" />
                        </template>
                    </STListItem>
                    <STListItem v-if="order.validAt" class="right-description">
                        Geplaatst op
                        <template slot="right">
                            {{ order.validAt | dateTime | capitalizeFirstLetter }}
                        </template>
                    </STListItem>
                    <STListItem class="right-description">
                        Bestelnummer

                        <template slot="right">
                            {{ order.number }}
                        </template>
                    </STListItem>
                    <template v-if="order.data.checkoutMethod">
                        <STListItem v-if="order.data.checkoutMethod.name" class="right-description">
                            <template v-if="order.data.checkoutMethod.type == 'Takeout'">
                                Afhaallocatie
                            </template>
                            <template v-else>
                                Leveringsmethode
                            </template>

                            <template slot="right">
                                {{ order.data.checkoutMethod.name }}
                            </template>
                        </STListItem>
                        <STListItem v-if="order.data.checkoutMethod.address" class="right-description">
                            Adres

                            <template slot="right">
                                {{ order.data.checkoutMethod.address }}
                            </template>
                        </STListItem>
                        <STListItem v-if="order.data.address" class="right-description">
                            Leveringsadres

                            <template slot="right">
                                {{ order.data.address }}
                            </template>
                        </STListItem>
                        <STListItem v-if="order.data.timeSlot" class="right-description">
                            Wanneer afhalen?

                            <template slot="right">
                                {{ order.data.timeSlot.date | date | capitalizeFirstLetter }}<br>{{ order.data.timeSlot.startTime | minutes }} - {{ order.data.timeSlot.endTime | minutes }}
                            </template>
                        </STListItem>
                        <STListItem v-if="order.data.checkoutMethod.description" class="right-description">
                            <template v-if="order.data.checkoutMethod.type == 'Takeout'">
                                Afhaalopmerkingen
                            </template>
                            <template v-else>
                                Leveringsopmerkingen
                            </template>

                            <template slot="right">
                                {{ order.data.checkoutMethod.description }}
                            </template>
                        </STListItem>
                    </template>
                    <STListItem class="right-description">
                        Totaal

                        <template slot="right">
                            {{ order.data.cart.price | price }}
                        </template>
                    </STListItem>
                </STList>

                <hr>

                <STList>
                    <STListItem v-for="cartItem in order.data.cart.items" :key="cartItem.id" class="cart-item-row">
                        <h3>
                            {{ cartItem.product.name }}
                        </h3>
                        <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

                        <footer>
                            <p class="price">
                                {{ cartItem.amount }} x {{ cartItem.unitPrice | price }}
                            </p>
                        </footer>

                        <figure v-if="imageSrc(cartItem)" slot="right">
                            <img :src="imageSrc(cartItem)">
                        </figure>
                    </STListItem>
                </STList>
            </main>

            <STToolbar v-if="canShare">
                <template slot="right">
                    <button class="button primary" @click="share">
                        <span class="icon share" />
                        <span>Doorsturen</span>
                    </button>
                </template>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage,ErrorBox, LoadingButton, LoadingView, Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar, TransferPaymentView } from "@stamhoofd/components"
import { CartItem, Order, PaymentMethod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        LoadingView
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter),
        date: Formatter.dateWithDay.bind(Formatter),
        dateTime: Formatter.dateTimeWithDay.bind(Formatter),
        minutes: Formatter.minutes.bind(Formatter),
        capitalizeFirstLetter: Formatter.capitalizeFirstLetter.bind(Formatter)
    }
})
export default class OrderView extends Mixins(NavigationMixin){
    loading = false
    errorBox: ErrorBox | null = null
    CheckoutManager = CheckoutManager

    @Prop({ default: null })
    orderId: string | null

    @Prop({ default: null })
    paymentId: string | null

    @Prop({ default: null })
    initialOrder!: Order | null

    @Prop({ default: false })
    success: boolean

    order: Order | null = this.initialOrder

    get canShare() {
        return !!navigator.share
    }

    share() {
        navigator.share({
            title: "Bestelling "+WebshopManager.webshop.meta.name,
            text: "Bekijk mijn bestelling bij "+WebshopManager.webshop.meta.name+" via deze link.",
            url: WebshopManager.webshop.getUrlSuffix()+"/order/"+this.order!.id,
        }).catch(e => console.error(e))
    }

    openTransferView() {
        if (this.order && this.order.payment && this.order.payment.method == PaymentMethod.Transfer) {
            this.present(new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(TransferPaymentView, {
                    payment: this.order.payment,
                    organization: WebshopManager.organization,
                    isPopup: true
                })
            }).setDisplayStyle("popup"))
        }
    }

    mounted() {
        if (this.success) {
            CheckoutManager.cart.items = []
            CheckoutManager.saveCheckout()
        }
        if (this.order) {
            HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/order/"+this.order.id)
            return;
        }
        // Load order
        if (this.orderId) {
            HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/order/"+this.orderId)

             WebshopManager.server
                .request({
                    method: "GET",
                    path: "/webshop/" +WebshopManager.webshop.id + "/order/"+this.orderId,
                    decoder: Order as Decoder<Order>,
                }).then(response => {
                    const order = response.data
                    this.order = order
                }).catch(e => {
                    // too: handle this
                    console.error(e)
                    new CenteredMessage("Ongeldige bestelling", "De bestelling die je opvraagt bestaat niet (meer)", "error").addCloseButton().show()
                    this.pop({ force: true })
                })
        } else {
            if (!this.paymentId) {
                throw new Error("Missing payment id or order id")
            }
            WebshopManager.server
                .request({
                    method: "GET",
                    path: "/webshop/" +WebshopManager.webshop.id + "/payment/"+this.paymentId+"/order",
                    decoder: Order as Decoder<Order>,
                }).then(response => {
                    const order = response.data
                    this.order = order
                    HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/order/"+this.order.id)
                }).catch(e => {
                    // too: handle this
                    console.error(e)
                    new CenteredMessage("Ongeldige bestelling", "De bestelling die je opvraagt bestaat niet (meer)", "error").addCloseButton().show()
                    this.pop({ force: true })
                })
        }
    }

    imageSrc(cartItem: CartItem) {
        return cartItem.product.images[0]?.getPathForSize(100, 100)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.order-view {
    .cart-item-row {
        h3 {
            padding-top: 5px;
            @extend .style-title-3;
        }

        .description {
            @extend .style-description-small;
            padding-top: 5px;
            white-space: pre-wrap;
        }

        .price {
            font-size: 14px;
            line-height: 1.4;
            font-weight: 600;
            padding-top: 10px;
            color: $color-primary;
        }

        footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        img {
            width: 100px;
            height: 100px;
            border-radius: $border-radius;
        }
    }
}
</style>