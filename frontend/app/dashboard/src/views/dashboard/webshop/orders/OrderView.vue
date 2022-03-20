<template>
    <div class="st-view order-view">
        <STNavigationBar :title="'Bestelling ' + order.number" :pop="canPop" :dismiss="canDismiss">
            <template #right>
                <button v-if="hasPreviousOrder || hasNextOrder" v-tooltip="'Ga naar vorige bestelling'" type="button" class="button navigation icon arrow-up" :disabled="!hasPreviousOrder" @click="goBack" />
                <button v-if="hasNextOrder || hasPreviousOrder" v-tooltip="'Ga naar volgende bestelling'" type="button" class="button navigation icon arrow-down" :disabled="!hasNextOrder" @click="goNext" />
                <button v-long-press="(e) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>
        <main>
            <h1>
                Bestelling {{ order.number }}
            </h1>

            <p v-if="order.payment && order.payment.status != 'Succeeded'" class="warning-box">
                Opgelet: deze bestelling werd nog niet betaald.
            </p>

            <STList>
                <STListItem class="right-description">
                    Naam

                    <template slot="right">
                        {{ order.data.customer.name }}
                    </template>
                </STListItem>

                <STListItem class="right-description">
                    GSM-nummer

                    <template slot="right">
                        <p>{{ order.data.customer.phone }}</p>
                    </template>
                </STListItem>

                <STListItem class="right-description">
                    E-mailadres

                    <template slot="right">
                        {{ order.data.customer.email }}
                    </template>
                </STListItem>

                <STListItem v-long-press="(e) => (hasWrite ? markAs(e) : null)" class="right-description right-stack" :selectable="hasWrite" @click="hasWrite ? markAs($event) : null">
                    Status

                    <template slot="right">
                        <span :class="'style-tag '+statusColor">{{ statusName }}</span>
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

                <STListItem v-if="order.payment" v-long-press="(e) => (hasPaymentsWrite && (order.payment.method == 'Transfer' || order.payment.method == 'PointOfSale') ? changePaymentStatus(e) : null)" class="right-description right-stack" :selectable="hasPaymentsWrite && (order.payment.method == 'Transfer' || order.payment.method == 'PointOfSale')" @click="hasPaymentsWrite && (order.payment.method == 'Transfer' || order.payment.method == 'PointOfSale') ? changePaymentStatus($event) : null">
                    Betaalmethode

                    <template slot="right">
                        <span>{{ getName(order.payment.method) }}</span>
                        <span v-if="order.payment.status == 'Succeeded'" class="icon green success" />
                        <span v-else class="icon clock" />
                        <span v-if="hasPaymentsWrite && ((order.payment && (order.payment.method == 'Transfer' || order.payment.method == 'PointOfSale')))" class="icon arrow-down-small" />
                    </template>
                </STListItem>

                <STListItem v-if="order.payment && order.payment.iban" class="right-description right-stack">
                    Betaald via IBAN

                    <template slot="right">
                        {{ order.payment.iban }}
                        <template v-if="order.payment.ibanName">
                            <br>({{ order.payment.ibanName }})
                        </template>
                    </template>
                </STListItem>
                
                <STListItem v-if="order.payment && order.payment.method == 'Transfer'" class="right-description right-stack">
                    Mededeling

                    <template slot="right">
                        {{ order.payment.transferDescription }}
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
                <STListItem v-if="order.payment && order.payment.settlement" class="right-description right-stack">
                    Uitbetaald op

                    <template slot="right">
                        {{ order.payment.settlement.settledAt | dateTime | capitalizeFirstLetter }}<br>
                        Mededeling "{{ order.payment.settlement.reference }}"
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
                        <template v-else-if="order.data.checkoutMethod.type == 'OnSite'">
                            Locatie
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
                        <template v-else-if="order.data.checkoutMethod.type == 'OnSite'">
                            Wanneer?
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

                <STListItem v-if="order.payment && order.payment.status === 'Succeeded' && order.payment.price != order.data.totalPrice" class="right-description">
                    Waarvan al betaald
                    
                    <template slot="right">
                        {{ order.payment.price | price }}
                    </template>
                </STListItem>
            </STList>

            <div v-if="order.data.comments" class="container">
                <hr>
                <h2 class="style-with-button">
                    <div>Notities</div>
                    <div v-if="hasWrite">
                        <button type="button" class="button icon edit gray" @click="editComments()" />
                    </div>
                </h2>

                <p class="pre-wrap" v-text="order.data.comments" />
            </div>
            <div v-else-if="hasWrite" class="container">
                <hr>
                <button class="button text selected" type="button" @click="editComments()">
                    <span class="icon add" />
                    <span>Notities toevoegen</span>
                </button>
            </div>

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

            <hr>

            <STList>
                <STListItem v-for="cartItem in order.data.cart.items" :key="cartItem.id" class="cart-item-row">
                    <h3>
                        <span>{{ cartItem.product.name }}</span>
                    </h3>
                    <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

                    <p v-if="cartItem.product.stock && order.shouldIncludeStock && cartItem.reservedAmount < cartItem.amount" class="warning-box">
                        De voorraad van {{ cartItem.product.name }} zal verminderd worden met {{ cartItem.amount - cartItem.reservedAmount }} stuk(s)
                    </p>
                    <p v-else-if="cartItem.product.stock && order.shouldIncludeStock && cartItem.reservedAmount > cartItem.amount" class="warning-box">
                        De voorraad van {{ cartItem.product.name }} zal aangevuld worden met {{ cartItem.reservedAmount - cartItem.amount }} stuk(s)
                    </p>

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

            <div v-if="hasTickets" class="container">
                <hr>
                <h2>Tickets</h2>
                <p>Is deze persoon zijn link kwijt, of is er een fout e-mailadres opgegeven? Dan kan je de volgende link bezorgen om de tickets opnieuw te laten downloaden.</p>

                <input v-tooltip="'Klik om te kopiëren'" class="input" :value="orderUrl" readonly @click="copyElement">
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CartItemView, CenteredMessage, ErrorBox, LoadingButton, LoadingView, LongPressDirective, Radio, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, TableActionsContextMenu, Toast, Tooltip, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { CartItem, getPermissionLevelNumber, OrderData, OrderStatusHelper, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PrivateOrder, ProductType, TicketPrivate, Version, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop, Watch } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import { WebshopManager } from "../WebshopManager";
import AddItemView from "./AddItemView.vue";
import { OrderActionBuilder } from "./OrderActionBuilder";

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
        tooltip: TooltipDirective,
        LongPress: LongPressDirective
    }
})
export default class OrderView extends Mixins(NavigationMixin){
    loading = false
    errorBox: ErrorBox | null = null

    @Prop({ required: true })
    initialOrder!: PrivateOrder

    @Prop({ required: true })
    webshopManager!: WebshopManager

    get webshop() {
        return this.webshopManager.preview
    }

    order: PrivateOrder = this.initialOrder
    tickets: TicketPrivate[] = []
    loadingTickets = false
    
    @Prop({ default: null })
    getNextOrder!: (order: PrivateOrder) => PrivateOrder | null;

    @Prop({ default: null })
    getPreviousOrder!: (order: PrivateOrder) => PrivateOrder | null;

    @Watch("order.payment.status")
    onChangePaymentStatus(n: string, old: string) {
        if (n === PaymentStatus.Succeeded && old !== PaymentStatus.Succeeded) {
            this.downloadNewTickets()
        }
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
        return this.webshop.meta.ticketType === WebshopTicketType.SingleTicket || !!this.order.data.cart.items.find(i => i.product.type === ProductType.Voucher || i.product.type === ProductType.Ticket)
    }

    get scannedCount() {
        return this.tickets.reduce((c, ticket) => c + (ticket.scannedAt ? 1 : 0), 0)
    }

    get actionBuilder() {
        return new OrderActionBuilder({
            webshopManager: this.webshopManager,
            component: this,
        })
    }

    get statusName() {
        return this.order ? OrderStatusHelper.getName(this.order.status) : ""
    }

    get statusColor() {
        return this.order ? OrderStatusHelper.getColor(this.order.status) : ""
    }

    showContextMenu(event) {
        const el = event.currentTarget;
        const bounds = el.getBoundingClientRect()

        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: bounds.left,
            y: bounds.bottom,
            xPlacement: "right",
            yPlacement: "bottom",
            actions: this.actionBuilder.getActions(),
            focused: [this.order]
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    markAs(event) {
        const el = (event.currentTarget as HTMLElement).querySelector(".right") ?? event.currentTarget;
        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: el.getBoundingClientRect().left + el.offsetWidth,
            y: el.getBoundingClientRect().top + el.offsetHeight,
            xPlacement: "left",
            yPlacement: "bottom",
            actions: this.actionBuilder.getStatusActions(),
            focused: [this.order]
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    changePaymentStatus(event) {
        const el = (event.currentTarget as HTMLElement).querySelector(".right") ?? event.currentTarget;
        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: el.getBoundingClientRect().left + el.offsetWidth,
            y: el.getBoundingClientRect().top + el.offsetHeight,
            xPlacement: "left",
            yPlacement: "bottom",
            actions: this.actionBuilder.getPaymentActions(),
            focused: [this.order]
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    editOrder() {
        this.actionBuilder.editOrder(this.order).catch(console.error)
    }

    editComments() {
        this.actionBuilder.editOrder(this.order, "comments").catch(console.error)
    }

    created() {
        if (this.hasTickets) {
            this.recheckTickets()
        }
    }

    recheckTickets() {
        if (this.hasTickets) {
            this.loadingTickets = true
            this.webshopManager.getTicketsForOrder(this.order.id, true).then((tickets) => {
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
        
        this.show({
            components: [component],
            replace: 1,
            reverse: true,
            animated: false
        })
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
        this.show({
            components: [component],
            replace: 1,
            animated: false
        })
    }

    getName(paymentMethod: PaymentMethod): string {
        return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(paymentMethod, this.order.data.paymentContext))
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

    imageSrc(cartItem: CartItem) {
        return cartItem.product.images[0]?.getPathForSize(100, 100)
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