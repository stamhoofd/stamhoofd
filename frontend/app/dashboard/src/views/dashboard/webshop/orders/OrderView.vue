<template>
    <div class="st-view order-view">
        <STNavigationBar :title="'Bestelling ' + patchedOrder.number">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
                <button v-if="hasPreviousOrder" class="button text" @click="goBack">
                    <span class="icon arrow-left" />
                    <span>Vorige</span>
                </button>
            </template>
            <template #right>
                <button v-if="hasNextOrder" class="button text" @click="goNext">
                    <span>Volgende</span>
                    <span class="icon arrow-right" />
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>
        <main>
            <h1>
                Bestelling {{ patchedOrder.number }}
            </h1>

            <p v-if="patchedOrder.payment && patchedOrder.payment.status != 'Succeeded'" class="warning-box">
                Opgelet: deze bestelling werd nog niet betaald.
            </p>

            <STList>
                <STListItem class="right-description">
                    Naam

                    <template slot="right">
                        <p>{{ patchedOrder.data.customer.name }}</p>
                        <p>{{ patchedOrder.data.customer.phone }}</p>
                        <p>{{ patchedOrder.data.customer.email }}</p>
                    </template>
                </STListItem>

                <STListItem class="right-description" :selectable="hasWrite" @click="hasWrite ? markAs($event) : null">
                    Status

                    <template slot="right">
                        <span v-if="patchedOrder.status == 'Created'" class="style-tag">Nieuw</span>
                        <span v-else-if="order.status == 'Prepared'" class="style-tag">Verwerkt</span>
                        <span v-else-if="order.status == 'Collect'" class="style-tag">Ligt klaar</span>
                        <span v-else-if="order.status == 'Completed'" class="style-tag success">Voltooid</span>
                        <span v-else-if="order.status == 'Canceled'" class="style-tag error">Geannuleerd</span>
                        <span v-else>Onbekend</span>
                        <span v-if="hasWrite" class="icon arrow-down-small" />
                    </template>
                </STListItem>

                <STListItem v-if="hasTickets" class="right-description">
                    Ticketstatus
                    
                    <template v-if="loadingTickets" slot="right">
                        -
                    </template>
                    <span v-else-if="tickets.length == 0" slot="right" class="style-tag">
                        Geen tickets
                    </span>
                    <span v-else-if="tickets.length == 1 && scannedCount == 1" slot="right" class="style-tag warn">
                        Gescand
                    </span>
                    <span v-else-if="tickets.length == 1 && scannedCount == 0" slot="right" class="style-tag success">
                        Nog niet gescand
                    </span>
                    <span v-else slot="right" class="style-tag" :class="{ warn: scannedCount > 0, success: scannedCount == 0}">
                        {{ scannedCount }} / {{ tickets.length }} gescand
                    </span>
                </STListItem>

                <STListItem v-for="a in patchedOrder.data.fieldAnswers" :key="a.field.id" class="right-description">
                    {{ a.field.name }}

                    <template slot="right">
                        {{ a.answer || "/" }}
                    </template>
                </STListItem>
                <STListItem v-if="patchedOrder.payment" class="right-description right-stack">
                    Betaalmethode

                    <template slot="right">
                        {{ getName(patchedOrder.payment.method) }}

                        <span v-if="patchedOrder.payment.status == 'Succeeded'" class="icon green success" />
                        <span v-else class="icon clock" />
                    </template>
                </STListItem>
                <STListItem v-if="patchedOrder.payment && patchedOrder.payment.method == 'Transfer'" class="right-description right-stack">
                    Mededeling

                    <template slot="right">
                        {{ patchedOrder.payment.transferDescription }}
                    </template>
                </STListItem>
                <STListItem v-if="patchedOrder.validAt" class="right-description">
                    Geplaatst op
                    <template slot="right">
                        {{ patchedOrder.validAt | dateTime | capitalizeFirstLetter }}
                    </template>
                </STListItem>
                <STListItem class="right-description">
                    Bestelnummer

                    <template slot="right">
                        {{ patchedOrder.number }}
                    </template>
                </STListItem>
                <template v-if="patchedOrder.data.checkoutMethod">
                    <STListItem v-if="patchedOrder.data.checkoutMethod.name" class="right-description">
                        <template v-if="patchedOrder.data.checkoutMethod.type == 'Takeout'">
                            Afhaallocatie
                        </template>
                        <template v-else-if="patchedOrder.data.checkoutMethod.type == 'OnSite'">
                            Locatie
                        </template>
                        <template v-else>
                            Leveringsmethode
                        </template>

                        <template slot="right">
                            {{ patchedOrder.data.checkoutMethod.name }}
                        </template>
                    </STListItem>
                    <STListItem v-if="patchedOrder.data.checkoutMethod.address" class="right-description">
                        Adres

                        <template slot="right">
                            {{ patchedOrder.data.checkoutMethod.address }}
                        </template>
                    </STListItem>
                    <STListItem v-if="patchedOrder.data.address" class="right-description">
                        Leveringsadres

                        <template slot="right">
                            {{ patchedOrder.data.address }}
                        </template>
                    </STListItem>
                    <STListItem v-if="patchedOrder.data.timeSlot" class="right-description">
                        <template v-if="patchedOrder.data.checkoutMethod.type == 'Takeout'">
                            Wanneer afhalen?
                        </template>
                        <template v-else-if="patchedOrder.data.checkoutMethod.type == 'OnSite'">
                            Wanneer?
                        </template>
                        <template v-else>
                            Wanneer leveren?
                        </template>

                        <template slot="right">
                            {{ patchedOrder.data.timeSlot.date | date | capitalizeFirstLetter }}<br>{{ patchedOrder.data.timeSlot.startTime | minutes }} - {{ patchedOrder.data.timeSlot.endTime | minutes }}
                        </template>
                    </STListItem>
                </template>
                <STListItem v-if="patchedOrder.data.deliveryPrice > 0" class="right-description">
                    Leveringskost

                    <template slot="right">
                        {{ patchedOrder.data.deliveryPrice | price }}
                    </template>
                </STListItem>
                <STListItem class="right-description">
                    Totaal

                    <template slot="right">
                        {{ patchedOrder.data.totalPrice | price }}
                    </template>
                </STListItem>

                <STListItem v-if="patchedOrder.payment && patchedOrder.payment.status === 'Succeeded' && patchedOrder.payment.price != patchedOrder.data.totalPrice" class="right-description">
                    Waarvan al betaald
                    
                    <template slot="right">
                        {{ patchedOrder.payment.price | price }}
                    </template>
                </STListItem>
            </STList>

            <LoadingButton v-if="hasPaymentsWrite && ((patchedOrder.payment && patchedOrder.payment.method == 'Transfer') && !isChanged())" :loading="loadingPayment">
                <p>
                    <button v-if="patchedOrder.payment && (patchedOrder.payment.status !== 'Succeeded' || patchedOrder.payment.price != patchedOrder.data.totalPrice)" class="button text" @click="markPaid(patchedOrder.payment)">
                        <span class="icon success" />
                        <span>Markeer als betaald</span>
                    </button>

                    <button v-if="patchedOrder.payment && patchedOrder.payment.status == 'Succeeded'" class="button text" @click="markNotPaid(patchedOrder.payment)">
                        <span class="icon canceled" />
                        <span>Markeer als niet betaald</span>
                    </button>
                </p>
            </LoadingButton>

            <div v-if="patchedOrder.data.checkoutMethod && patchedOrder.data.checkoutMethod.description" class="container">
                <hr>
                <h2 v-if="patchedOrder.data.checkoutMethod.type == 'Takeout'">
                    Afhaalopmerkingen
                </h2>
                <h2 v-else>
                    Leveringsopmerkingen
                </h2>

                <p class="pre-wrap" v-text="patchedOrder.data.checkoutMethod.description" />
            </div>

            <hr>

            <STList>
                <STListItem v-for="cartItem in patchedOrder.data.cart.items" :key="cartItem.id" class="cart-item-row" :selectable="hasWrite" @click="hasWrite ? editCartItem(cartItem) : false">
                    <h3>
                        <span>{{ cartItem.product.name }}</span>
                        <span v-if="hasWrite" class="icon arrow-right-small gray" />
                    </h3>
                    <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

                    <p v-if="cartItem.product.stock && patchedOrder.shouldIncludeStock && cartItem.reservedAmount < cartItem.amount" class="warning-box">
                        De voorraad van {{ cartItem.product.name }} zal verminderd worden met {{ cartItem.amount - cartItem.reservedAmount }} stuk(s)
                    </p>
                    <p v-else-if="cartItem.product.stock && patchedOrder.shouldIncludeStock && cartItem.reservedAmount > cartItem.amount" class="warning-box">
                        De voorraad van {{ cartItem.product.name }} zal aangevuld worden met {{ cartItem.reservedAmount - cartItem.amount }} stuk(s)
                    </p>

                    <footer>
                        <p class="price">
                            {{ cartItem.amount }} x {{ cartItem.getUnitPrice(patchedOrder.data.cart) | price }}
                        </p>
                    </footer>

                    <figure v-if="imageSrc(cartItem)" slot="right">
                        <img :src="imageSrc(cartItem)">
                    </figure>
                </STListItem>
            </STList>

            <p v-if="hasWrite">
                <button class="button text" @click="addProduct">
                    <span class="icon add" />
                    <span>Nieuw</span>
                </button>
            </p>

            <div v-if="hasTickets" class="container">
                <hr>
                <h2>Tickets</h2>
                <p>Is deze persoon zijn link kwijt, of is er een fout e-mailadres opgegeven? Dan kan je de volgende link bezorgen om de tickets opnieuw te laten downloaden.</p>

                <input v-tooltip="'Klik om te kopiëren'" class="input" :value="orderUrl" readonly @click="copyElement">
            </div>

            <div v-if="hasWrite" class="container">
                <hr>
                <h2>Wijzigingen maken</h2>
                <p>
                    Als een bestelling geplaatst wordt, dan houden we een momentopname bij van die bestelling. Als je daarna bijvoorbeeld de naam van een product wijzigt, blijft die onveranderd in deze bestelling. Je kan dit corrigeren door bovenaan op een product te klikken, de (eventuele) wijzigingen na te kijken en op te slaan. Als er intussen bijvoorbeeld nieuwe keuzemogelijkheden zijn toegevoegd, kan je dan ook een keuze maken.
                </p>
            </div>
        </main>

        <STToolbar v-if="hasWrite && isChanged()">
            <LoadingButton slot="right" :loading="saving">
                <button class="button primary" @click="save()">
                    Opslaan
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, patchContainsChanges } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CartItemView, CenteredMessage, ErrorBox, LoadingButton, LoadingView, Radio, STErrorsDefault,STList, STListItem, STNavigationBar, STToolbar, Toast, Tooltip, TooltipDirective } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking";
import { CartItem, EncryptedPaymentDetailed, getPermissionLevelNumber, Order, OrderData, Payment, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PrivateOrder, ProductType, TicketPrivate, Version, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import { WebshopManager } from "../WebshopManager";
import AddItemView from "./AddItemView.vue";
import OrderStatusContextMenu from "./OrderStatusContextMenu.vue";

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
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class OrderView extends Mixins(NavigationMixin){
    loading = false
    loadingPayment = false
    errorBox: ErrorBox | null = null

    @Prop({ required: true })
    initialOrder!: Order

    @Prop({ required: true })
    webshopManager!: WebshopManager

    get webshop() {
        return this.webshopManager.preview
    }

    @Prop({ default: false })
    success: boolean

    order: Order = this.initialOrder

    patchOrder: AutoEncoderPatchType<Order> = Order.patch({})

    tickets: TicketPrivate[] = []
    loadingTickets = false
    
    @Prop({ default: null })
    getNextOrder!: (order: Order) => Order | null;

    @Prop({ default: null })
    getPreviousOrder!: (order: Order) => Order | null;

    get patchedOrder() {
        return this.order.patch(this.patchOrder)
    }

    get hasNextOrder(): boolean {
        if (!this.getNextOrder || !this.order) {
            return false
        }
        return !!this.getNextOrder(this.order);
    }

    get hasPreviousOrder(): boolean {
        if (!this.getPreviousOrder || !this.order) {
            return false
        }
        return !!this.getPreviousOrder(this.order);
    }

    get hasPaymentsWrite() {
        const p = SessionManager.currentSession?.user?.permissions
        if (!p) {
            return false
        }
        if (p.canManagePayments(OrganizationManager.organization.privateMeta?.roles ?? []) || p.hasFullAccess()) {
            return true
        }
        return getPermissionLevelNumber(this.webshop.privateMeta.permissions.getPermissionLevel(p)) >= getPermissionLevelNumber(PermissionLevel.Write)
    }

    get hasWrite() {
        const p = SessionManager.currentSession?.user?.permissions
        if (!p) {
            return false
        }
        return getPermissionLevelNumber(this.webshop.privateMeta.permissions.getPermissionLevel(p)) >= getPermissionLevelNumber(PermissionLevel.Write)
    }

    get hasTickets() {
        return this.webshop.meta.ticketType === WebshopTicketType.SingleTicket || !!this.patchedOrder.data.cart.items.find(i => i.product.type !== ProductType.Product)
    }

    get scannedCount() {
        return this.tickets.reduce((c, ticket) => c + (ticket.scannedAt ? 1 : 0), 0)
    }

    markAs(event) {
        const displayedComponent = new ComponentWithProperties(OrderStatusContextMenu, {
            x: event.clientX,
            y: event.clientY,
            orders: [this.order],
            webshopManager: this.webshopManager
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    created() {
        if (this.hasTickets) {
            this.recheckTickets()
        }
    }

    recheckTickets() {
        if (this.hasTickets) {
            this.loadingTickets = true
            this.webshopManager.getTicketsForOrder(this.patchedOrder.id, true).then((tickets) => {
                this.tickets = tickets
                this.loadingTickets = false
            }).catch(e => {
                console.error(e)
                new Toast("Het laden van de tickets die bij deze bestelling horen is mislukt", "error red").show()
                this.loadingTickets = false
            }).finally(() => {
                this.downloadNewTickets()
            })
        }
    }

    goBack() {
        const order = this.getPreviousOrder(this.order);
        if (!order) {
            return;
        }
        const component = new ComponentWithProperties(OrderView, {
            initialOrder: order,
            webshopManager: this.webshopManager,
            getNextOrder: this.getNextOrder,
            getPreviousOrder: this.getPreviousOrder,
        });
        this.navigationController?.push(component, true, 1, true);
    }

    goNext() {
        const order = this.getNextOrder(this.order);
        if (!order) {
            return;
        }
        const component = new ComponentWithProperties(OrderView, {
            initialOrder: order,
            webshopManager: this.webshopManager,
            getNextOrder: this.getNextOrder,
            getPreviousOrder: this.getPreviousOrder,
        });
        this.navigationController?.push(component, true, 1, false);
    }

    getName(paymentMethod: PaymentMethod): string {
        return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(paymentMethod))
    }

    activated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.addEventListener("keydown", this.onKey);
    }

    deactivated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        if (!this.isFocused()) {
            return
        }

        const key = event.key || event.keyCode;

        if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") {
            this.goBack();
            event.preventDefault();
        } else if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") {
            this.goNext();
            event.preventDefault();
        }
    }

    openTransferView() {
        // todo
    }

    imageSrc(cartItem: CartItem) {
        return cartItem.product.images[0]?.getPathForSize(100, 100)
    }

    async markPaid(payment: Payment) {
        if (this.loadingPayment) {
            return;
        }

        const data: AutoEncoderPatchType<Payment>[] = []
        if (payment.status != PaymentStatus.Succeeded || this.order.data.cart.price != payment.price) {
            data.push(Payment.patch({
                id: payment.id,
                price: this.order.data.cart.price,
                status: PaymentStatus.Succeeded
            }))
        }

        if (data.length > 0) {
            if (!await CenteredMessage.confirm("Ben je zeker?", "Markeer als betaald", "De besteller ontvangt een automatische e-mail. Tip: je kan dit ook via het menu 'Overschrijvingen' doen voor meerdere overschrijvingen in één keer, dat spaart je wat werk uit.")) {
                return;
            }
            this.loadingPayment = true
            const session = SessionManager.currentSession!

            try {
                const response = await session.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/payments",
                    body: data,
                    decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>),
                    shouldRetry: false
                })
                const p = response.data.find(pp => pp.id === payment.id)
                if (p) {
                    payment.set(p)
                }
                this.downloadNewTickets()
            } catch (e) {
                Toast.fromError(e).show()
            }
            this.loadingPayment = false
            
        }
    }

    saving = false

    save() {
        if (this.saving) {
            return
        }
        this.saving = true
        this.patchOrder.id = this.order.id
        this.webshopManager.patchOrders(
            [
                PrivateOrder.patch(this.patchOrder as any)
            ]
        ).then((orders) => {
            this.saving = false
            new Toast("Wijzigingen opgeslagen", "success").setHide(1000).show()

            // Move all data to original order
            for (const order of orders) {
                if (order.id === this.order.id) {
                    this.order.set(order)
                }
            }
            this.patchOrder = Order.patch({})
            this.downloadNewTickets()
        }).catch((e) => {
            this.saving = false
            Toast.fromError(e).show()
        })
    }

    downloadNewTickets() {
        if (!this.hasTickets) {
            return
        }
        this.webshopManager.fetchNewTickets(false, false, (tickets: TicketPrivate[]) => {
            for (const ticket of tickets) {
                if (ticket.orderId === this.order.id) {
                    const existing = this.tickets.find(t => t.id === ticket.id)
                    if (existing) {
                        existing.set(ticket)
                    } else {
                        this.tickets.push(ticket)
                    }
                }
            }
        }).catch(console.error);
    }

    async addProduct() {
        let clone = this.patchedOrder.data.cart.clone()
        const webshop = await this.webshopManager.loadWebshopIfNeeded()

        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(AddItemView, { 
                cart: clone,
                webshop: webshop,
                saveHandler: (cartItem: CartItem, oldItem: CartItem | null) => {
                    cartItem.validate(webshop, clone)

                    if (oldItem) {
                        clone.removeItem(oldItem)
                    }
                    clone.addItem(cartItem)

                    if (clone.price != this.patchedOrder.data.cart.price) {
                        new Toast("De totaalprijs van de bestelling is gewijzigd. Je moet dit zelf communiceren naar de besteller en de betaling hiervan opvolgen indien nodig.", "warning yellow").setHide(10*1000).show();
                    }

                    this.patchOrder = this.patchOrder.patch({ data: OrderData.patch({
                        cart: clone
                    })})
                }
            })
        }).setDisplayStyle("sheet"))
    }

    async editCartItem(cartItem: CartItem ) {
        let clone = this.patchedOrder.data.cart.clone()
        const webshop = await this.webshopManager.loadWebshopIfNeeded()

        const newCartItem = cartItem.clone()

        // First refresh the item
        try {
            newCartItem.refresh(webshop)
        } catch (e) {
            Toast.fromError(e).show()
        }

        this.present(new ComponentWithProperties(CartItemView, { 
            cartItem: newCartItem, 
            oldItem: cartItem,
            cart: clone,
            webshop: webshop,
            saveHandler: (cartItem: CartItem, oldItem: CartItem | null) => {
                cartItem.validate(webshop, clone)
                if (oldItem) {
                    clone.removeItem(oldItem)
                }
                clone.addItem(cartItem)

                if (clone.price != this.patchedOrder.data.cart.price) {
                    new Toast("De totaalprijs van de bestelling is gewijzigd. Je moet dit zelf communiceren naar de besteller en de betaling hiervan opvolgen indien nodig.", "warning yellow").setHide(10*1000).show();
                }

                this.patchOrder = this.patchOrder.patch({ data: OrderData.patch({
                    cart: clone
                })})
            }
        }).setDisplayStyle("sheet"))
    }

    async markNotPaid(payment: Payment) {
        if (this.loadingPayment) {
            return;
        }

        const data: AutoEncoderPatchType<Payment>[] = []
        if (payment.status == PaymentStatus.Succeeded) {
            data.push(Payment.patch({
                id: payment.id,
                status: PaymentStatus.Created
            }))
        }

        if (data.length > 0) {
            if (!await CenteredMessage.confirm("Ben je zeker dat deze betaling niet uitgevoerd is?", "Niet betaald")) {
                return;
            }
            this.loadingPayment = true
            const session = SessionManager.currentSession!

            try {
                const response = await session.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/payments",
                    body: data,
                    decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>),
                    shouldRetry: false
                })
                const p = response.data.find(pp => pp.id === payment.id)
                if (p) {
                    payment.set(p)
                }
            } catch (e) {
                Toast.fromError(e).show()
            }
            this.loadingPayment = false
            
        }
    }

    get orderUrl() {
        return "https://"+this.webshop.getUrl(OrganizationManager.organization)+"/order/"+(this.order.id)
    }

    copyElement(event) {
        event.target.contentEditable = true;

        document.execCommand('selectAll', false);
        document.execCommand('copy')

        event.target.contentEditable = false;

        const displayedComponent = new ComponentWithProperties(Tooltip, {
            text: "📋 Gekopieerd!",
            x: event.clientX,
            y: event.clientY + 10,
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));

        setTimeout(() => {
            displayedComponent.vnode?.componentInstance?.$parent.$emit("pop");
        }, 1000);
    }

    isChanged() {
        return patchContainsChanges(this.patchOrder, this.order, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
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

    .pre-wrap {
        @extend .style-description;
        white-space: pre-wrap;
    }
}
</style>