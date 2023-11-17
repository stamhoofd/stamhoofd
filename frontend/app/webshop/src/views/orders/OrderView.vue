<template>
    <LoadingView v-if="!order" />
    <div v-else class="st-view order-view box-shade">
        <STNavigationBar :large="true" :sticky="false">
            <OrganizationLogo slot="left" :organization="organization" />
            <button slot="right" class="text button" type="button" @click="pop">
                Sluiten
            </button>
        </STNavigationBar>

        <main>
            <div class="box">
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

                    <p v-if="isCanceled" class="error-box">
                        Deze bestelling werd geannuleerd
                    </p>

                    <section v-if="!isCanceled && hasTickets && (isPaid || !isTransfer)" id="tickets" class="container">
                        <hr>
                        <h2 class="style-with-button">
                            <div v-if="singleTicket">
                                Jouw ticket
                            </div>
                            <div v-else>
                                Jouw tickets
                            </div>
                            <div class="hover-show">
                                <button v-if="!loadingTickets" class="button text limit-space" type="button" @click="downloadAllTickets">
                                    <span class="icon download" />
                                    <span>Opslaan</span>
                                </button>
                            </div>
                        </h2>
                        <p v-if="!singleTicket" class="hide-smartphone style-description">
                            Klik op een ticket om die individueel te downloaden of de QR-code te vergroten. Toon je ticket bij voorkeur op je smartphone.
                        </p>
                        <p v-if="!singleTicket" class="only-smartphone style-description">
                            Tik op een ticket om die individueel te downloaden of de QR-code te tonen.
                        </p>

                        <p v-if="singleTicket" class="style-description">
                            Open of download je ticket hieronder. Toon je ticket bij voorkeur op je smartphone.
                        </p>

                        <Spinner v-if="loadingTickets" />
                        <template v-else>
                            <button v-if="publicTickets.length === 1" class="button primary" type="button" @click="openTicket(publicTickets[0])">
                                <span class="icon qr-code" />
                                <span>Ticket tonen</span>
                            </button>

                            <STList v-else>
                                <TicketListItem v-for="ticket in publicTickets" :key="ticket.id" :ticket="ticket" :webshop="webshop" :order="order" />
                            </STList>
                        </template>

                        <hr>
                        <h2>Overzicht</h2>
                    </section>

                    <template v-else-if="hasTickets">
                        <hr>
                        <h2 v-if="singleTicket">
                            Jouw ticket
                        </h2>
                        <h2 v-else>
                            Jouw tickets
                        </h2>

                        <p v-if="!isPaid && isTransfer" class="warning-box">
                            Je ontvangt <template v-if="singleTicket">
                                jouw ticket
                            </template><template v-else>
                                jouw tickets
                            </template> via e-mail zodra we jouw overschrijving hebben ontvangen. Je kan ze dan ook op deze pagina terugvinden. Zorg er zeker voor dat je meteen betaalt zodat het bedrag op tijd op onze rekening staat. Klik onderaan op de knop om de instructies nog eens te tonen.
                        </p>
                        <p v-else>
                            Je vindt <template v-if="singleTicket">
                                jouw ticket
                            </template><template v-else>
                                jouw tickets
                            </template> onderaan deze pagina.
                        </p>

                        <a v-if="isPaid" href="#tickets" class="button primary">
                            <span class="icon arrow-down" />
                            <span v-if="singleTicket">Ticket bekijken</span>
                            <span v-else>Tickets bekijken</span>
                        </a>

                        <hr>
                        <h2>Overzicht</h2>
                    </template>
                    <p v-else-if="!isCanceled && !isPaid && isTransfer" class="warning-box">
                        Opgelet: deze bestelling moet worden betaald via overschrijving, daardoor weten we niet automatisch of deze al betaald werd of niet. Zorg er zeker voor dat je deze meteen betaalt zodat het bedrag op tijd op onze rekening komt. Klik onderaan op de knop om de instructies nog eens te tonen.
                    </p>
                    <p v-else-if="!isCanceled && !isPaid && !isTransfer" class="warning-box">
                        Opgelet: je zal deze bestelling nog moeten betalen {{ getLowerCaseName(order.payment.method) }}
                    </p>

                    <STList class="info">
                        <STListItem class="right-description">
                            <h3 class="style-definition-label">
                                Bestelnummer
                            </h3>

                            <p class="style-definition-text">
                                {{ order.number }}
                            </p>
                        </STListItem>
                        <STListItem class="right-description">
                            <h3 class="style-definition-label">
                                Naam
                            </h3>

                            <p class="style-definition-text">
                                {{ order.data.customer.name }}
                            </p>
                        </STListItem>
                        <STListItem class="right-description">
                            <h3 class="style-definition-label">
                                E-mailadres
                            </h3>

                            <p class="style-definition-text">
                                {{ order.data.customer.email }}
                            </p>
                        </STListItem>
                        <STListItem v-if="order.payment" class="right-description right-stack" :selectable="order.payment.status != 'Succeeded'" @click="openTransferView">
                            <h3 class="style-definition-label">
                                Betaalmethode
                            </h3>

                            <p class="style-definition-text">
                                <span>{{ getName(order.payment.method) }}</span>

                                <span v-if="order.payment.status == 'Succeeded'" class="icon green success" />
                                <span v-else-if="isTransfer" class="icon help" />
                            </p>
                        </STListItem>
                        <STListItem v-for="a in order.data.fieldAnswers" :key="a.field.id" class="right-description">
                            <h3 class="style-definition-label">
                                {{ a.field.name }}
                            </h3>

                            <p class="style-definition-text">
                                {{ a.answer || "/" }}
                            </p>
                        </STListItem>
                        <STListItem v-if="order.validAt" class="right-description">
                            <h3 class="style-definition-label">
                                Geplaatst op
                            </h3>
                            <p class="style-definition-text">
                                {{ order.validAt | dateTime | capitalizeFirstLetter }}
                            </p>
                        </STListItem>

                        <STListItem class="right-description">
                            <h3 class="style-definition-label">
                                Status
                            </h3>

                            <p class="style-definition-text">
                                <span>{{ statusName }}</span>
                                <span v-if="isCanceled" class="icon canceled" />
                            </p>
                        </STListItem>
                                                
                        <template v-if="order.data.checkoutMethod">
                            <STListItem v-if="order.data.checkoutMethod.name" class="right-description">
                                <h3 class="style-definition-label">
                                    <template v-if="order.data.checkoutMethod.type == 'Takeout'">
                                        Afhaallocatie
                                    </template>
                                    <template v-else-if="order.data.checkoutMethod.type == 'OnSite'">
                                        Locatie
                                    </template>
                                    <template v-else>
                                        Leveringsmethode
                                    </template>
                                </h3>

                                <p class="style-definition-text">
                                    {{ order.data.checkoutMethod.name }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.data.checkoutMethod.address" class="right-description">
                                <h3 class="style-definition-label">
                                    Adres
                                </h3>

                                <p class="style-definition-text">
                                    {{ order.data.checkoutMethod.address }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.data.address" class="right-description">
                                <h3 class="style-definition-label">
                                    Leveringsadres
                                </h3>

                                <p class="style-definition-text">
                                    {{ order.data.address }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.data.timeSlot" class="right-description">
                                <h3 class="style-definition-label">
                                    <template v-if="order.data.checkoutMethod.type == 'Takeout'">
                                        Wanneer afhalen?
                                    </template>
                                    <template v-else-if="order.data.checkoutMethod.type == 'OnSite'">
                                        Wanneer?
                                    </template>
                                    <template v-else>
                                        Wanneer leveren?
                                    </template>
                                </h3>

                                <p class="style-definition-text">
                                    {{ order.data.timeSlot.date | date | capitalizeFirstLetter }}<br>{{ order.data.timeSlot.startTime | minutes }} - {{ order.data.timeSlot.endTime | minutes }}
                                </p>
                            </STListItem>
                        </template>
                        <STListItem v-if="order.data.deliveryPrice > 0" class="right-description">
                            <h3 class="style-definition-label">
                                Leveringskost
                            </h3>

                            <p class="style-definition-text">
                                {{ order.data.deliveryPrice | price }}
                            </p>
                        </STListItem>
                        <STListItem v-if="order.data.administrationFee > 0" class="right-description">
                            <h3 class="style-definition-label">
                                Administratiekosten
                            </h3>

                            <p class="style-definition-text">
                                {{ order.data.administrationFee | price }}
                            </p>
                        </STListItem>
                        <STListItem v-if="order.data.totalPrice || !webshop.isAllFree" class="right-description">
                            <h3 class="style-definition-label">
                                Totaal
                            </h3>

                            <p class="style-definition-text">
                                {{ order.data.totalPrice | price }}
                            </p>
                        </STListItem>
                    </STList>

                    <div v-for="category in recordCategories" :key="'category-'+category.id" class="container">
                        <hr>
                        <h2>
                            {{ category.name }}
                        </h2>
                        <RecordCategoryAnswersBox :category="category" :answers="recordAnswers" :data-permission="true" />
                    </div>

                    <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                        <hr>
                        <h2 v-if="order.data.checkoutMethod.type == 'Takeout'">
                            Afhaalopmerkingen
                        </h2>
                        <h2 v-else-if="order.data.checkoutMethod.type == 'OnSite'">
                            Opmerkingen
                        </h2>
                        <h2 v-else>
                            Leveringsopmerkingen
                        </h2>

                        <p class="pre-wrap" v-text="order.data.checkoutMethod.description" />
                    </div>

                    <template v-if="!hasTickets || hasSingleTicket || !isPaid">
                        <hr>

                        <STList>
                            <STListItem v-for="cartItem in order.data.cart.items" :key="cartItem.id" class="cart-item-row">
                                <h3>
                                    {{ cartItem.product.name }}
                                </h3>
                                <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

                                <footer>
                                    <p class="price">
                                        {{ cartItem.amount }} x {{ formatFreePrice(cartItem.getUnitPrice(order.data.cart)) }}
                                    </p>
                                </footer>

                                <figure v-if="imageSrc(cartItem)" slot="right">
                                    <img :src="imageSrc(cartItem)">
                                </figure>
                            </STListItem>
                        </STList>
                    </template>
                </main>
                <STToolbar v-if="!isCanceled && ((canShare && !hasTickets) || !isPaid)" :sticky="false">
                    <template slot="right">
                        <button v-if="canShare && !hasTickets" class="button secundary" type="button" @click="share">
                            <span class="icon share" />
                            <span>Delen</span>
                        </button>
                        <button v-if="!isPaid && isTransfer" class="button primary" type="button" @click="openTransferView">
                            <span class="icon card" />
                            <span>Betaalinstructies</span>
                        </button>
                    </template>
                </STToolbar>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, ErrorBox, LoadingButton, LoadingView, OrganizationLogo, Radio, RecordCategoryAnswersBox, Spinner, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, Toast, TransferPaymentView } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { RecordCategory } from '@stamhoofd/structures';
import { CartItem, Order, OrderStatus, OrderStatusHelper, PaymentMethod, PaymentMethodHelper, PaymentStatus, ProductType, TicketOrder, TicketPublic, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import TicketBox from '../products/TicketBox.vue';
import TicketListItem from '../products/TicketListItem.vue';
import DetailedTicketView from './DetailedTicketView.vue';

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
        TicketBox,
        TicketListItem,
        RecordCategoryAnswersBox
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

    tickets: TicketPublic[] = []
    loadingTickets = false

    get organization() {
        return WebshopManager.organization
    }

    get webshop() {
        return WebshopManager.webshop
    }

    get singleTicket() {
        return this.tickets.length == 1 || this.webshop.meta.ticketType === WebshopTicketType.SingleTicket
    }

    get canShare() {
        return !!navigator.share
    }

    get isPaid() {
        return this.order && (this.order.payment === null || this.order.payment.status === PaymentStatus.Succeeded)
    }

    get isTransfer() {
        return this.order && this.order.payment !== null && this.order.payment.method === PaymentMethod.Transfer
    }

    get isCanceled() {
        return !this.order || this.order.status === OrderStatus.Canceled || this.order.status === OrderStatus.Deleted
    }

    get hasTickets() {
        return (this.order && this.order.status != OrderStatus.Canceled && this.order.status != OrderStatus.Deleted) && (this.webshop.meta.ticketType === WebshopTicketType.SingleTicket || !!this.order?.data.cart.items.find(i => i.product.type === ProductType.Voucher || i.product.type === ProductType.Ticket))
    }

    get hasSingleTicket() {
        return this.webshop.meta.ticketType === WebshopTicketType.SingleTicket
    }

    get statusName() {
        return this.order ? OrderStatusHelper.getName(this.order.status) : ""
    }

    get statusColor() {
        return this.order ? OrderStatusHelper.getColor(this.order.status) : ""
    }

    get publicTickets() {
        return this.tickets
    }

    get recordCategories(): RecordCategory[] {
        if (!this.order) {
            return []
        }
        return RecordCategory.flattenCategoriesForAnswers(
            this.webshop.meta.recordCategories,
            this.order.data.recordAnswers
        )
    }

    get recordAnswers() {
        return this.order?.data.recordAnswers ?? []
    }

    formatFreePrice(price: number) {
        if (price === 0) {
            return ''
        }
        return Formatter.price(price)
    }

    share() {
        navigator.share({
            title: "Bestelling "+WebshopManager.webshop.meta.name,
            text: "Bekijk mijn bestelling bij "+WebshopManager.webshop.meta.name+" via deze link.",
            url: WebshopManager.webshop.getUrl(this.organization)+"/order/"+this.order!.id,
        }).catch(e => console.error(e))
    }

    getName(paymentMethod: PaymentMethod): string {
        return PaymentMethodHelper.getNameCapitalized(paymentMethod, this.order?.data.paymentContext)
    }

    getLowerCaseName(paymentMethod: PaymentMethod): string {
        return PaymentMethodHelper.getName(paymentMethod, this.order?.data.paymentContext)
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
        if (!this.hasTickets || !this.order || (!this.isPaid && this.isTransfer)) {
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
            this.tickets = response.data.map(ticket => ticket.getPublic(this.order!)).sort(TicketPublic.sort)
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
            UrlHelper.setUrl("/order/"+this.order.id)
            this.checkTickets().catch(console.error)
            return;
        }
        // Load order
        if (this.orderId) {
            UrlHelper.setUrl("/order/"+this.orderId)

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
                    UrlHelper.setUrl("/order/"+this.order.id)
                    this.checkTickets().catch(console.error)
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
            '@stamhoofd/ticket-builder'
        )).TicketBuilder

        const builder = new TicketBuilder(this.publicTickets, this.webshop, WebshopManager.organization, this.order ?? undefined)
        await builder.download()
    }

    openTicket(ticket: TicketPublic) {
        this.present({
            components: [
                new ComponentWithProperties(DetailedTicketView, {
                    ticket: ticket,
                    order: this.order,
                    webshop: this.webshop
                })
            ],
            modalDisplayStyle: "sheet"
        })
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
