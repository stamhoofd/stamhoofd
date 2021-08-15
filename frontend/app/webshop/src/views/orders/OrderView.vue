<template>
    <LoadingView v-if="!order" />
    <div v-else class="st-view order-view">
        <STNavigationBar :large="true" :sticky="false">
            <OrganizationLogo slot="left" :organization="organization" />
            <button slot="right" class="text button" @click="pop">
                Webshop
            </button>
        </STNavigationBar>

        <main class="limit-width">
            <section class="white-top view">
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

                    <template v-if="hasTickets">
                        <hr>
                        <h2>Jouw tickets</h2>

                        <p v-if="!isPaid" class="warning-box">
                            Je ontvangt jouw tickets via e-mail zodra we jouw overschrijving manueel hebben gemarkeerd als betaald. Zorg er zeker voor dat je deze meteen betaalt zodat het bedrag op tijd op onze rekening staat. Klik onderaan op de knop om de instructies nog eens te tonen.
                        </p>
                        <p v-else>Zorg dat je jouw tickets zeker meeneemt.</p>

                        <a v-if="isPaid" href="#tickets" class="button primary">
                            <span class="icon arrow-down" />
                            <span>Tickets bekijken</span>
                        </a>

                        <hr>
                        <h2>Overzicht</h2>
                    </template>
                    <p v-else-if="!isPaid" class="warning-box">
                        Opgelet: deze bestelling moet worden betaald via overschrijving, daardoor weten we niet automatisch of deze al betaald werd of niet. Zorg er zeker voor dat je deze meteen betaalt zodat het bedrag op tijd op onze rekening komt. Klik onderaan op de knop om de instructies nog eens te tonen.
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
                                {{ getName(order.payment.method) }}

                                <span v-if="order.payment.status == 'Succeeded'" class="icon green success" />
                                <span v-else class="icon help" />
                            </template>
                        </STListItem>
                        <STListItem v-for="a in order.data.fieldAnswers" :key="a.field.id" class="right-description">
                            {{ a.field.name }}

                            <template slot="right">
                                {{ a.answer || "/" }}
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

                        <STListItem class="right-description">
                            Status

                            <template slot="right">
                                <span v-if="order.status == 'Prepared'" class="style-tag">Verwerkt</span>
                                <span v-else-if="order.status == 'Completed'" class="style-tag success">Voltooid</span>
                                <span v-else-if="order.status == 'Canceled'" class="style-tag error">Geannuleerd</span>
                                <span v-else>Geplaatst</span>
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
                                <template v-if="order.data.checkoutMethod.type == 'Takeout'">
                                    Wanneer afhalen?
                                </template>
                                <template v-else>
                                    Wanneer leveren?
                                </template>

                                <template slot="right">
                                    {{ order.data.timeSlot.date | date | capitalizeFirstLetter }}<br>{{ order.data.timeSlot.startTime | minutes }} - {{ order.data.timeSlot.endTime | minutes }}
                                </template>
                            </STListItem>
                        </template>
                        <STListItem v-if="order.data.deliveryPrice > 0" class="right-description">
                            Leveringskost

                            <template slot="right">
                                {{ order.data.deliveryPrice | price }}
                            </template>
                        </STListItem>
                        <STListItem class="right-description">
                            Totaal

                            <template slot="right">
                                {{ order.data.totalPrice | price }}
                            </template>
                        </STListItem>
                    </STList>

                    <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                        <hr>
                        <h2 v-if="order.data.checkoutMethod.type == 'Takeout'">
                            Afhaalopmerkingen
                        </h2>
                        <h2 v-else>
                            Leveringsopmerkingen
                        </h2>

                        <p class="pre-wrap" v-text="order.data.checkoutMethod.description" />
                    </div>

                    <template v-if="!hasTickets || !isPaid">
                        <hr>

                        <STList>
                            <STListItem v-for="cartItem in order.data.cart.items" :key="cartItem.id" class="cart-item-row">
                                <h3>
                                    {{ cartItem.product.name }}
                                </h3>
                                <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

                                <footer>
                                    <p class="price">
                                        {{ cartItem.amount }} x {{ cartItem.getUnitPrice(order.data.cart) | price }}
                                    </p>
                                </footer>

                                <figure v-if="imageSrc(cartItem)" slot="right">
                                    <img :src="imageSrc(cartItem)">
                                </figure>
                            </STListItem>
                        </STList>
                    </template>

                    <STToolbar v-if="(canShare && !hasTickets) || !isPaid">
                        <template slot="right">
                            <button v-if="canShare && !hasTickets" class="button secundary" @click="share">
                                <span class="icon share" />
                                <span>Delen</span>
                            </button>
                            <button v-if="!isPaid" class="button primary" @click="openTransferView">
                                <span class="icon card" />
                                <span>Betaalinstructies</span>
                            </button>
                        </template>
                    </STToolbar>
                </main>
            </section>
            <section v-if="hasTickets && isPaid" class="gray-shadow view">
                <main id="tickets">
                    <h2>Download tickets</h2>

                    <div class="hide-smartphone">
                        <p class="success-box environment">
                            Open deze pagina op jouw smartphone om alle tickets digitaal op te slaan in Google Pay, Apple Wallet of als PDF. Op die manier hoef je de tickets niet af te drukken. Je kan ook een individueel ticket scannen om enkel dat ticket op te slaan of te delen.
                        </p>
                    </div>
                    <p class="success-box environment only-smartphone">
                        Je hoeft de tickets niet af te drukken, je kan ze ook tonen op jouw smartphone. Sla ze eventueel op zodat je ze niet kwijt geraakt.
                    </p>

                    <button v-if="!loadingTickets" class="button primary" @click="downloadAllTickets">
                        <span class="icon download" />
                        <span>Download alle tickets</span>
                    </button>

                    <Spinner v-if="loadingTickets" />
                    <div v-else>
                        <TicketBox v-for="ticket in publicTickets" :key="ticket.id" :ticket="ticket" :webshop="webshop" />
                    </div>
                </main>
            </section>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,CenteredMessage,ErrorBox, LoadingButton, LoadingView, OrganizationLogo, Radio, Spinner, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar, Toast, TransferPaymentView } from "@stamhoofd/components"
import { CartItem, Order, PaymentMethod, PaymentMethodHelper, PaymentStatus, ProductType, TicketOrder } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import TicketBox from '../products/TicketBox.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        LoadingView,
        BackButton,
        OrganizationLogo,
        Spinner,
        TicketBox
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

    tickets: TicketOrder[] = []
    loadingTickets = false

    get organization() {
        return WebshopManager.organization
    }

    get webshop() {
        return WebshopManager.webshop
    }

    get canShare() {
        return !!navigator.share
    }

    get isPaid() {
        return this.order && (this.order.payment === null || this.order.payment.status === PaymentStatus.Succeeded)
    }

    get hasTickets() {
        return !!this.order?.data.cart.items.find(i => i.product.type !== ProductType.Product)
    }

    get publicTickets() {
        return this.tickets.map(ticket => ticket.getPublic(this.order!))
    }

    share() {
        navigator.share({
            title: "Bestelling "+WebshopManager.webshop.meta.name,
            text: "Bekijk mijn bestelling bij "+WebshopManager.webshop.meta.name+" via deze link.",
            url: WebshopManager.webshop.getUrlSuffix()+"/order/"+this.order!.id,
        }).catch(e => console.error(e))
    }

    getName(paymentMethod: PaymentMethod): string {
        return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(paymentMethod))
    }

    openTransferView() {
        if (this.order && this.order.payment && this.order.payment.method == PaymentMethod.Transfer) {
            this.present(new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(TransferPaymentView, {
                    type: "order",
                    payment: this.order.payment,
                    organization: WebshopManager.organization,
                    settings: WebshopManager.webshop.meta.transferSettings,
                    isPopup: true
                })
            }).setDisplayStyle("popup"))
        }
    }

    async checkTickets() {
        if (!this.hasTickets || !this.order || !this.isPaid) {
            return
        }
        this.loadingTickets = true

        try {
            const response = await WebshopManager.server.request({
                method: "GET",
                path: "/webshop/" +WebshopManager.webshop.id + "/tickets",
                query: {
                    // Required because we don't need to repeat item information (network + database impact)
                    orderId: this.order.id
                },
                decoder: new ArrayDecoder(TicketOrder as Decoder<TicketOrder>)
            })
            this.tickets = response.data
        } catch (e) {
            Toast.fromError(e).show()
        }        

        this.loadingTickets = false
    }

    mounted() {
        if (this.success) {
            CheckoutManager.cart.items = []
            CheckoutManager.saveCheckout()

            // Update stock in background
            WebshopManager.reload().catch(e => {
                console.error(e)
            })
        }
        if (this.order) {
            HistoryManager.setUrl(WebshopManager.webshop.getUrlSuffix()+"/order/"+this.order.id)
            this.checkTickets().catch(console.error)
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
                    this.checkTickets().catch(console.error)
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

    async downloadAllTickets() {
        const TicketBuilder = (await import(
            /* webpackChunkName: "TicketBuilder" */
            /* webpackPrefetch: true */
            '../../classes/TicketBuilder'
        )).TicketBuilder

        const builder = new TicketBuilder(this.publicTickets, this.webshop, WebshopManager.organization)
        await builder.download()
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
            width: 70px;
            height: 70px;
            border-radius: $border-radius;

            @media (min-width: 340px) {
                width: 80px;
                height: 80px;
            }

            @media (min-width: 801px) {
                width: 100px;
                height: 100px;
            }
        }
    }
    .pre-wrap {
        @extend .style-description;
        white-space: pre-wrap;
    }
}
</style>