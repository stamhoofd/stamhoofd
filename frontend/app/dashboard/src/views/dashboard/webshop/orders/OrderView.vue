<template>
    <div class="st-view order-view">
        <STNavigationBar :title="'Bestelling #' + order.number">
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
                <STListItem v-if="order.totalToPay || !webshop.isAllFree">
                    <h3 class="style-definition-label">
                        Totaal te betalen
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.totalToPay) }}
                    </p>
                </STListItem>

                <STListItem v-if="(order.totalToPay || !webshop.isAllFree) && (isMissingPayments || (order.pricePaid > 0 && order.pricePaid !== order.totalToPay))">
                    <h3 class="style-definition-label">
                        Betaald bedrag
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.pricePaid) }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Geplaatst op
                    </h3>
                    <p class="style-definition-text">
                        {{ capitalizeFirstLetter(formatDateTime(order.validAt)) }}
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
                    <template v-if="hasWrite" #right>
                        <span class="icon arrow-down-small gray" />
                    </template>
                </STListItem>

                <STListItem
                    v-for="(payment, index) in order.payments"
                    :key="payment.id"
                    v-long-press="(e) => (hasPaymentsWrite && (payment.method === 'Transfer' || payment.method === 'PointOfSale') && order.payments.length === 1 ? changePaymentStatus(e) : null)" :selectable="hasPaymentsWrite"
                    class="right-description" @click="openPayment(payment)"
                    @contextmenu.prevent="hasPaymentsWrite && (payment.method === 'Transfer' || payment.method === 'PointOfSale') && order.payments.length === 1 ? changePaymentStatus($event) : null"
                >
                    <h3 class="style-definition-label">
                        {{ payment.price >= 0 ? 'Betaling' : 'Terugbetaling' }} {{ order.payments.length > 1 ? index + 1 : '' }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ getName(payment.method) }}</span>
                        <span v-if="payment.status === 'Succeeded'" class="icon primary success" />
                        <span v-else class="icon clock" />
                    </p>

                    <template v-if="order.payments.length > 1 || hasPaymentsWrite" #right>
                        <span v-if="order.payments.length > 1">{{ formatPrice(payment.price) }}</span>
                        <span v-if="hasPaymentsWrite" class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="hasTickets" class="right-description right-stack" :selectable="tickets.length > 0" @click="tickets.length > 0 ? openTickets($event) : null">
                    <h3 v-if="tickets.length > 1 || (!hasSingleTickets && tickets.length === 0)" class="style-definition-label">
                        Tickets
                    </h3>
                    <h3 v-else class="style-definition-label">
                        Ticket
                    </h3>

                    <p class="style-definition-text">
                        <template v-if="loadingTickets">
                            -
                        </template>
                        <span v-else-if="hasSingleTickets && tickets.length === 0" class="gray">
                            Geen ticket
                        </span>
                        <span v-else-if="tickets.length === 0" class="gray">
                            Geen tickets
                        </span>
                        <span v-else-if="hasSingleTickets && tickets.length === 1 && scannedCount === 1">
                            Gescand
                        </span>
                        <span v-else-if="hasSingleTickets && tickets.length === 1 && scannedCount === 0">
                            Niet gescand
                        </span>
                        <span v-else>
                            {{ scannedCount }} / {{ tickets.length }} gescand
                        </span>
                    </p>

                    <template v-if="tickets.length > 0" #right>
                        <span class="icon arrow-right-small" />
                    </template>
                </STListItem>
            </STList>

            <p v-if="didChangePrice" class="warning-box">
                Het te betalen bedrag van deze bestelling is gewijzigd nadat de bestelling geplaatst werd.
            </p>

            <p v-if="hasPaymentsWrite && isMissingPayments" class="warning-box">
                Er werd nog geen betaling aangemaakt voor alle producten in deze bestelling. Registreer een betaling/terugbetaling
            </p>

            <button v-if="hasPaymentsWrite && isMissingPayments" class="button text" type="button" @click="createPayment">
                <span class="icon add" />
                <span>Betaling / terugbetaling registreren</span>
            </button>

            <template v-if="order.data.checkoutMethod">
                <hr>
                <h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                    Afhalen
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type === 'Delivery'">
                    Levering
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                    Ter plaatse consumeren
                </h2>
                <h2 v-else>
                    Onbekende methode
                </h2>

                <STList class="info">
                    <STListItem v-if="order.data.checkoutMethod.name" class="right-description">
                        <h3 class="style-definition-label">
                            <template v-if="order.data.checkoutMethod.type === 'Takeout'">
                                Afhaallocatie
                            </template>
                            <template v-else-if="order.data.checkoutMethod.type === 'OnSite'">
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
                            <template v-if="order.data.checkoutMethod.type === 'Takeout'">
                                Wanneer afhalen?
                            </template>
                            <template v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                                Wanneer?
                            </template>
                            <template v-else>
                                Wanneer leveren?
                            </template>
                        </h3>

                        <p class="style-definition-text">
                            {{ capitalizeFirstLetter(formatDate(order.data.timeSlot.date)) }}<br>{{ formatMinutes(order.data.timeSlot.startTime) }} - {{ formatMinutes(order.data.timeSlot.endTime) }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.deliveryPrice > 0" class="right-description">
                        <h3 class="style-definition-label">
                            Leveringskost
                        </h3>

                        <p class="style-definition-text">
                            {{ formatPrice(order.data.deliveryPrice) }}
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
                        {{ $t("90d84282-3274-4d85-81cd-b2ae95429c34") }}
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

                <STListItem v-if="order.data.comments" :selectable="true" @click="editComments()">
                    <h3 class="style-definition-label">
                        Notities
                    </h3>

                    <p class="style-definition-text pre-wrap" v-text="order.data.comments" />
                    <template v-if="hasWrite" #right>
                        <span class="icon edit" />
                    </template>
                </STListItem>
            </STList>

            <div v-if="!order.data.comments && hasWrite" class="container">
                <button class="button text" type="button" @click="editComments()">
                    <span class="icon edit" />
                    <span>Notities</span>
                </button>
            </div>

            <div v-for="category in recordCategories" :key="'category-'+category.id" class="container">
                <hr>
                <h2>
                    {{ category.name }}
                </h2>
                <ViewRecordCategoryAnswersBox :category="category" :value="order.data" />
            </div>

            <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                <hr>
                <h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                    Afhaalopmerkingen
                </h2>
                <h2 v-else>
                    Leveringsopmerkingen
                </h2>

                <p class="pre-wrap" v-text="order.data.checkoutMethod.description" />
            </div>

            <hr>

            <p v-for="code of order.data.discountCodes" :key="code.id" class="discount-box icon label">
                <span>Kortingscode <span class="style-discount-code">{{ code.code }}</span></span>
            </p>

            <STList>
                <CartItemRow v-for="cartItem of order.data.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="order.data.cart" :webshop="webshop" :editable="false" :admin="true" />
            </STList>

            <hr>

            <PriceBreakdownBox :price-breakdown="order.data.priceBreakown" />
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop, Watch } from '@simonbackx/vue-app-navigation/classes';
import { CartItemRow, EditPaymentView, ErrorBox, GlobalEventBus, LoadingButton, LoadingView, LongPressDirective, PaymentView, PriceBreakdownBox, Radio, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, TableActionsContextMenu, TableActionSelection, Toast, TooltipDirective, ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { AccessRight, CartItem, OrderStatus, OrderStatusHelper, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PrivateOrderWithTickets, ProductType, RecordCategory, RecordWarning, TicketPrivate, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { WebshopManager } from '../WebshopManager';
import { OrderActionBuilder } from './OrderActionBuilder';
import OrderTicketsView from './OrderTicketsView.vue';
import TicketRow from './TicketRow.vue';

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
        ViewRecordCategoryAnswersBox,
        CartItemRow,
        PriceBreakdownBox,
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter),
        date: Formatter.dateWithDay.bind(Formatter),
        dateTime: Formatter.dateTimeWithDay.bind(Formatter),
        minutes: Formatter.minutes.bind(Formatter),
        capitalizeFirstLetter: Formatter.capitalizeFirstLetter.bind(Formatter),
    },
    directives: {
        tooltip: TooltipDirective,
        LongPress: LongPressDirective,
    },
})
export default class OrderView extends Mixins(NavigationMixin) {
    loading = false;
    errorBox: ErrorBox | null = null;

    @Prop({ required: true })
    initialOrder!: PrivateOrderWithTickets;

    @Prop({ required: true })
    webshopManager!: WebshopManager;

    get webshop() {
        return this.webshopManager.preview;
    }

    get didChangePrice() {
        return this.order.balanceItems.flatMap(b => b.payments).length > 1 || this.isMissingPayments;
    }

    get isMissingPayments() {
        return this.order.payments.reduce((a, b) => a + b.price, 0) !== this.order.totalToPay;
    }

    order: PrivateOrderWithTickets = this.initialOrder;
    loadingTickets = false;

    @Prop({ default: null })
    getNextOrder!: (order: PrivateOrderWithTickets) => PrivateOrderWithTickets | null;

    @Prop({ default: null })
    getPreviousOrder!: (order: PrivateOrderWithTickets) => PrivateOrderWithTickets | null;

    @Watch('order.payment.status')
    onChangePaymentStatus(n: string, old: string) {
        if (n === PaymentStatus.Succeeded && old !== PaymentStatus.Succeeded) {
            this.downloadNewTickets();
        }
    }

    formatFreePrice(price: number) {
        if (price === 0) {
            return '';
        }
        return Formatter.price(price);
    }

    get tickets() {
        return this.order.tickets;
    }

    get hasWarnings() {
        return this.warnings.length > 0;
    }

    get warnings(): RecordWarning[] {
        const warnings: RecordWarning[] = [];

        for (const answer of this.recordAnswers.values()) {
            warnings.push(...answer.getWarnings());
        }

        return warnings;
    }

    get sortedWarnings() {
        return this.warnings.slice().sort(RecordWarning.sort);
    }

    openTickets() {
        this.present({
            components: [
                new ComponentWithProperties(OrderTicketsView, {
                    initialOrder: this.order,
                    webshopManager: this.webshopManager,
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }

    openPayment(payment: PaymentGeneral) {
        if (!this.hasPaymentsWrite) {
            return;
        }
        this.present({
            components: [
                new ComponentWithProperties(PaymentView, {
                    payment,
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }

    get hasNextOrder(): boolean {
        if (!this.getNextOrder || !this.order) {
            return false;
        }
        return !!this.getNextOrder(this.order);
    }

    get hasPreviousOrder(): boolean {
        if (!this.getPreviousOrder || !this.order) {
            return false;
        }
        return !!this.getPreviousOrder(this.order);
    }

    get hasPaymentsWrite() {
        const p = this.$context.organizationPermissions;
        if (!p) {
            return false;
        }
        if (p.hasAccessRight(AccessRight.OrganizationManagePayments)) {
            return true;
        }

        if (p.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
            return true;
        }

        return this.webshop.privateMeta.permissions.hasWriteAccess(p);
    }

    get hasWrite() {
        const p = this.$context.organizationPermissions;
        if (!p) {
            return false;
        }
        return this.webshop.privateMeta.permissions.hasWriteAccess(p);
    }

    get hasSingleTickets() {
        return this.webshop.meta.ticketType === WebshopTicketType.SingleTicket;
    }

    get hasTickets() {
        return this.webshop.meta.ticketType === WebshopTicketType.SingleTicket || !!this.order.data.cart.items.find(i => i.product.type === ProductType.Voucher || i.product.type === ProductType.Ticket);
    }

    get scannedCount() {
        return this.tickets.reduce((c, ticket) => c + (ticket.scannedAt ? 1 : 0), 0);
    }

    get actionBuilder() {
        return new OrderActionBuilder({
            organizationManager: this.$organizationManager,
            webshopManager: this.webshopManager,
            component: this,
        });
    }

    get statusName() {
        return this.order ? OrderStatusHelper.getName(this.order.status) : '';
    }

    get statusColor() {
        return this.order ? OrderStatusHelper.getColor(this.order.status) : '';
    }

    get isCanceled() {
        return this.order.status === OrderStatus.Canceled;
    }

    showContextMenu(event) {
        const el = event.currentTarget;
        const bounds = el.getBoundingClientRect();

        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: bounds.left,
            y: bounds.bottom,
            xPlacement: 'right',
            yPlacement: 'bottom',
            actions: this.actionBuilder.getActions(),
            selection: {
                filter: {}, // todo
                fetcher: {}, // todo
                markedRows: new Map([[this.order.id, this.order]]),
                markedRowsAreSelected: true,
            } as TableActionSelection<PrivateOrderWithTickets>,
        });
        this.present(displayedComponent.setDisplayStyle('overlay'));
    }

    markAs(event) {
        const el = (event.currentTarget as HTMLElement).querySelector('.right') ?? event.currentTarget;
        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: el.getBoundingClientRect().left + el.offsetWidth,
            y: el.getBoundingClientRect().top + el.offsetHeight,
            xPlacement: 'left',
            yPlacement: 'bottom',
            actions: this.actionBuilder.getStatusActions(),
            // todo: selection
        });
        this.present(displayedComponent.setDisplayStyle('overlay'));
    }

    changePaymentStatus(event) {
        const x = event.changedTouches ? event.changedTouches[0].pageX : event.clientX;
        const y = event.changedTouches ? event.changedTouches[0].pageY : event.clientY;

        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x,
            y,
            xPlacement: 'right',
            yPlacement: 'bottom',
            actions: this.actionBuilder.getPaymentActions(),
            // todo: selection
        });
        this.present(displayedComponent.setDisplayStyle('overlay'));
    }

    editOrder() {
        this.actionBuilder.editOrder(this.order).catch(console.error);
    }

    editComments() {
        this.actionBuilder.editOrder(this.order, 'comments').catch(console.error);
    }

    created() {
        this.webshopManager.ticketsEventBus.addListener(this, 'fetched', this.onNewTickets.bind(this));
        this.webshopManager.ticketPatchesEventBus.addListener(this, 'patched', this.onNewTicketPatches.bind(this));

        if (this.hasTickets) {
            this.recheckTickets();
        }

        // Listen for patches in payments
        GlobalEventBus.addListener(this, 'paymentPatch', async (payment) => {
            if (payment && payment.id && this.order.payments.find(p => p.id === payment.id as string)) {
                // Reload tickets and order
                await this.downloadNewOrders();
                this.downloadNewTickets();
            }
            return Promise.resolve();
        });
    }

    recheckTickets() {
        if (this.hasTickets) {
            this.loadingTickets = true;
            this.webshopManager.getTicketsForOrder(this.order.id, true).then((tickets) => {
                this.order.tickets = tickets;
                this.loadingTickets = false;
            }).catch((e) => {
                console.error(e);
                this.loadingTickets = false;
            }).finally(() => {
                this.downloadNewTickets();
            });
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
            animated: false,
        });
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
            animated: false,
        });
    }

    getName(paymentMethod: PaymentMethod): string {
        return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(paymentMethod, this.order.data.paymentContext));
    }

    async onNewTickets(tickets: TicketPrivate[]) {
        this.order.addTickets(tickets);
        return Promise.resolve();
    }

    onNewTicketPatches(patches: AutoEncoderPatchType<TicketPrivate>[]) {
        this.order.addTicketPatches(patches);
        return Promise.resolve();
    }

    beforeUnmount() {
        this.webshopManager.ticketsEventBus.removeListener(this);
        this.webshopManager.ticketPatchesEventBus.removeListener(this);
        this.webshopManager.ordersEventBus.removeListener(this);
    }

    activated() {
        document.addEventListener('keydown', this.onKey);
    }

    deactivated() {
        document.removeEventListener('keydown', this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        if (!this.isFocused) {
            return;
        }

        const key = event.key || event.keyCode;

        if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') {
            this.goBack();
            event.preventDefault();
        }
        else if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown') {
            this.goNext();
            event.preventDefault();
        }
    }

    imageSrc(cartItem: CartItem) {
        return cartItem.product.images[0]?.getPathForSize(100, 100);
    }

    async downloadNewOrders() {
        await this.webshopManager.fetchNewOrdersDeprecated(false, false);
    }

    downloadNewTickets() {
        if (!this.hasTickets) {
            return;
        }
        this.webshopManager.fetchNewTickets(false, false).catch((e) => {
            if (this.tickets.length === 0) {
                if (Request.isNetworkError(e)) {
                    new Toast('Het laden van de tickets die bij deze bestelling horen is mislukt. Controleer je internetverbinding en probeer opnieuw.', 'error red').show();
                }
                else {
                    Toast.fromError(e).show();
                    new Toast('Het laden van de tickets die bij deze bestelling horen is mislukt', 'error red').show();
                }
            }
        });
    }

    get recordCategories(): RecordCategory[] {
        return RecordCategory.flattenCategoriesForAnswers(
            this.webshop.meta.recordCategories,
            [...this.order.data.recordAnswers.values()],
        );
    }

    get recordAnswers() {
        return this.order.data.recordAnswers;
    }

    createPayment() {
        const payment = PaymentGeneral.create({
            method: PaymentMethod.PointOfSale,
            status: PaymentStatus.Succeeded,
            paidAt: new Date(),
        });

        const component = new ComponentWithProperties(EditPaymentView, {
            payment,
            balanceItems: this.order.balanceItems,
            isNew: true,
            saveHandler: async (patch: AutoEncoderPatchType<PaymentGeneral>) => {
                const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
                arr.addPut(payment.patch(patch));
                await this.$context.authenticatedServer.request({
                    method: 'PATCH',
                    path: '/organization/payments',
                    body: arr,
                    decoder: new ArrayDecoder(PaymentGeneral),
                    shouldRetry: false,
                });

                // Update order
                await this.downloadNewOrders();
            },
        });
        this.present({
            components: [component],
            modalDisplayStyle: 'popup',
        });
    }
}
</script>
