<template>
    <div class="st-view order-view">
        <STNavigationBar :title="'Bestelling #' + order.number" :pop="canPop" :dismiss="canDismiss">
            <template #right>
                <button v-if="hasPreviousOrder || hasNextOrder" v-tooltip="'Ga naar vorige bestelling'" type="button" class="button navigation icon arrow-up" :disabled="!hasPreviousOrder" @click="goBack" />
                <button v-if="hasNextOrder || hasPreviousOrder" v-tooltip="'Ga naar volgende bestelling'" type="button" class="button navigation icon arrow-down" :disabled="!hasNextOrder" @click="goNext" />
                <button v-long-press="(e) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>
        <main>
            <h1>
                Bestelling #{{ order.number }}
            </h1>

            <div v-if="hasWarnings" class="hover-box container">
                <ul class="member-records">
                    <li
                        v-for="warning in sortedWarnings"
                        :key="warning.id"
                        :class="{ [warning.type]: true }"
                    >
                        <span :class="'icon '+warning.icon" />
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
                <hr>
            </div>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Totaalbedrag
                    </h3>
                    <p class="style-definition-text">
                        <!-- eslint-disable-next-line vue/singleline-html-element-content-newline -->
                        {{ order.data.totalPrice | price }}<template v-if="order.payment && (order.payment.price != order.data.totalPrice || !order.payment && order.data.totalPrice > 0)">*</template>
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Geplaatst op
                    </h3>
                    <p class="style-definition-text">
                        {{ order.validAt | dateTime | capitalizeFirstLetter }}
                    </p>
                </STListItem>

                <STListItem v-long-press="(e) => (hasWrite ? markAs(e) : null)" class="right-description right-stack" :selectable="hasWrite" @click="hasWrite ? markAs($event) : null">
                    <h3 :class="'style-definition-label '+statusColor">
                        Status
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ statusName }}</span>
                        <span v-if="isCanceled" class="icon canceled" />
                    </p>
                    <span v-if="hasWrite" slot="right" class="icon arrow-down-small gray" />
                </STListItem>

                <STListItem
                    v-if="order.payment" v-long-press="(e) => (hasPaymentsWrite && (order.payment.method == 'Transfer' || order.payment.method == 'PointOfSale') ? changePaymentStatus(e) : null)" :selectable="hasPaymentsWrite" 
                    @click="openPayment" @contextmenu.prevent="hasPaymentsWrite && (order.payment.method == 'Transfer' || order.payment.method == 'PointOfSale') ? changePaymentStatus($event) : null"
                >
                    <h3 class="style-definition-label">
                        Betaling
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ getName(order.payment.method) }}</span>
                        <span v-if="order.payment.status == 'Succeeded'" class="icon primary success" />
                        <span v-else class="icon clock" />
                    </p>

                    <span v-if="hasPaymentsWrite" slot="right" class="icon arrow-right-small gray" />
                </STListItem>

                <STListItem v-if="hasTickets" class="right-description right-stack" :selectable="tickets.length > 0" @click="tickets.length > 0 ? openTickets($event) : null">
                    <h3 v-if="tickets.length > 1 || (!hasSingleTickets && tickets.length == 0)" class="style-definition-label">
                        Tickets
                    </h3>
                    <h3 v-else class="style-definition-label">
                        Ticket
                    </h3>

                    <p class="style-definition-text">
                        <template v-if="loadingTickets">
                            -
                        </template>
                        <span v-else-if="hasSingleTickets && tickets.length == 0" class="gray">
                            Geen ticket
                        </span>
                        <span v-else-if="tickets.length == 0" slot="right" class="gray">
                            Geen tickets
                        </span>
                        <span v-else-if="hasSingleTickets && tickets.length == 1 && scannedCount == 1" slot="right">
                            Gescand
                        </span>
                        <span v-else-if="hasSingleTickets && tickets.length == 1 && scannedCount == 0" slot="right">
                            Niet gescand
                        </span>
                        <span v-else slot="right">
                            {{ scannedCount }} / {{ tickets.length }} gescand
                        </span>
                    </p>

                    <span v-if="tickets.length > 0" slot="right" class="icon arrow-right-small" />
                </STListItem>
            </STList>

            <p v-if="!order.payment && order.data.totalPrice > 0" class="warning-box">
                *Er werd geen betaling aangemaakt voor deze bestelling. Je moet zelf de betaalinformatie communiceren.
            </p>

            <p v-if="order.payment && order.payment.price != order.data.totalPrice" class="warning-box">
                *De totaalprijs van deze bestelling is gewijzigd nadat de bestelling geplaatst werd. De betaling die daardoor aangemaakt is is dus enkel van toepassing op het oorspronkelijke bedrag. Je moet zelf de communicatie in orde brengen voor het overige gedeelte.
            </p>
            
            <template v-if="order.data.checkoutMethod">
                <hr>
                <h2 v-if="order.data.checkoutMethod.type == 'Takeout'">
                    Afhalen
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type == 'Delivery'">
                    Levering
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type == 'OnSite'">
                    Ter plaatse consumeren
                </h2>
                <h2 v-else>
                    Onbekende methode
                </h2>

                <STList class="info">
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
                    <STListItem v-if="order.data.deliveryPrice > 0" class="right-description">
                        <h3 class="style-definition-label">
                            Leveringskost
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.deliveryPrice | price }}
                        </p>
                    </STListItem>
                </STList>
            </template>

            <hr>
            <h2>Gegevens</h2>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Naam
                    </h3>
                    <p class="style-definition-text">
                        {{ order.data.customer.name }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        E-mailadres
                    </h3>
                    <p class="style-definition-text">
                        {{ order.data.customer.email }}
                    </p>
                </STListItem>

                <STListItem v-if="order.data.customer.phone">
                    <h3 class="style-definition-label">
                        {{ $t("shared.inputs.mobile.label") }}
                    </h3>
                    <p class="style-definition-text">
                        {{ order.data.customer.phone }}
                    </p>
                </STListItem>

                <STListItem v-for="a in order.data.fieldAnswers" :key="a.field.id">
                    <h3 class="style-definition-label">
                        {{ a.field.name }}
                    </h3>

                    <p class="style-definition-text">
                        {{ a.answer || "/" }}
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
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, LoadingView, LongPressDirective, Radio, RecordCategoryAnswersBox, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, TableActionsContextMenu, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { CartItem, getPermissionLevelNumber, OrderStatus, OrderStatusHelper, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PrivateOrderWithTickets, ProductType, RecordCategory, RecordWarning, TicketPrivate, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop, Watch } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import PaymentView from "../../payments/PaymentView.vue";
import { WebshopManager } from "../WebshopManager";
import { OrderActionBuilder } from "./OrderActionBuilder";
import OrderTicketsView from "./OrderTicketsView.vue";
import TicketRow from "./TicketRow.vue";

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
        TicketRow,
        RecordCategoryAnswersBox
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
        initialOrder!: PrivateOrderWithTickets

    @Prop({ required: true })
        webshopManager!: WebshopManager

    get webshop() {
        return this.webshopManager.preview
    }

    order: PrivateOrderWithTickets = this.initialOrder
    loadingTickets = false
    
    @Prop({ default: null })
        getNextOrder!: (order: PrivateOrderWithTickets) => PrivateOrderWithTickets | null;

    @Prop({ default: null })
        getPreviousOrder!: (order: PrivateOrderWithTickets) => PrivateOrderWithTickets | null;

    @Watch("order.payment.status")
    onChangePaymentStatus(n: string, old: string) {
        if (n === PaymentStatus.Succeeded && old !== PaymentStatus.Succeeded) {
            this.downloadNewTickets()
        }
    }

    get tickets() {
        return this.order.tickets
    }

    get hasWarnings() {
        return this.warnings.length > 0
    }

    get warnings(): RecordWarning[] {
        const warnings: RecordWarning[] = []

        for (const answer of this.recordAnswers) {
            warnings.push(...answer.getWarnings())
        }

        return warnings
    }

    get sortedWarnings() {
        return this.warnings.slice().sort(RecordWarning.sort)
    }

    openTickets() {
        this.present({
            components: [
                new ComponentWithProperties(OrderTicketsView, {
                    initialOrder: this.order,
                    webshopManager: this.webshopManager,
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    openPayment() {
        if (!this.hasPaymentsWrite) {
            return;
        }
        this.present({
            components: [
                new ComponentWithProperties(PaymentView, {
                    initialPayment: this.order.payment
                })
            ],
            modalDisplayStyle: "popup"
        })
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

    get hasSingleTickets() {
        return this.webshop.meta.ticketType === WebshopTicketType.SingleTicket
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

    get isCanceled() {
        return this.order.status === OrderStatus.Canceled
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
        const x = event.changedTouches ? event.changedTouches[0].pageX : event.clientX
        const y = event.changedTouches ? event.changedTouches[0].pageY : event.clientY

        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x,
            y,
            xPlacement: "right",
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
        this.webshopManager.ticketsEventBus.addListener(this, "fetched", this.onNewTickets.bind(this))
        this.webshopManager.ticketPatchesEventBus.addListener(this, "patched", this.onNewTicketPatches.bind(this))
        
        if (this.hasTickets) {
            this.recheckTickets()
        }
    }

    recheckTickets() {
        if (this.hasTickets) {
            this.loadingTickets = true
            this.webshopManager.getTicketsForOrder(this.order.id, true).then((tickets) => {
                this.order.tickets = tickets
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

    async onNewTickets(tickets: TicketPrivate[]) {        
        for (const ticket of tickets) {
            if (ticket.orderId == this.order.id) {
                const existing = this.order.tickets.find(t => t.id === ticket.id);
                if (existing) {
                    existing.set(ticket)
                } else {
                    this.order.tickets.push(ticket)
                }
            }
        }

        return Promise.resolve()
    }

    onNewTicketPatches(patches: AutoEncoderPatchType<TicketPrivate>[]) {        
        for (const patch of patches) {
            for (const ticket of this.order.tickets) {
                if (ticket.id === patch.id) {
                    ticket.set(ticket.patch(patch))
                    break;
                }
            }
        }

        return Promise.resolve()
    }

    beforeDestroy() {
        this.webshopManager.ticketsEventBus.removeListener(this)
        this.webshopManager.ticketPatchesEventBus.removeListener(this)
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
                        this.order.tickets.push(ticket)
                    }
                }
            }
        }).catch(console.error);
    }

    get recordCategories(): RecordCategory[] {
        return RecordCategory.flattenCategoriesForAnswers(
            this.webshop.meta.recordCategories,
            this.order.data.recordAnswers
        )
    }

    get recordAnswers() {
        return this.order.data.recordAnswers
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