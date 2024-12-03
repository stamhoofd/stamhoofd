<template>
    <div class="st-view order-view">
        <STNavigationBar :title="'Bestelling #' + order.number">
            <template #right>
                <button v-if="hasPreviousOrder || hasNextOrder" v-tooltip="'Ga naar vorige bestelling'" type="button" class="button navigation icon arrow-up" :disabled="!hasPreviousOrder" @click="goBack" />
                <button v-if="hasNextOrder || hasPreviousOrder" v-tooltip="'Ga naar volgende bestelling'" type="button" class="button navigation icon arrow-down" :disabled="!hasNextOrder" @click="goNext" />
                <button v-long-press="(e: MouseEvent) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
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

            <STList v-if="webshop" class="info">
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

                <STListItem v-if="order.validAt">
                    <h3 class="style-definition-label">
                        Geplaatst op
                    </h3>
                    <p class="style-definition-text">
                        {{ capitalizeFirstLetter(formatDateTime(order.validAt)) }}
                    </p>
                </STListItem>

                <STListItem v-long-press="(e: MouseEvent) => (hasWrite ? markAs(e) : null)" class="right-description right-stack" :selectable="hasWrite" @click="hasWrite ? markAs($event) : null">
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
                    v-long-press="(e: MouseEvent) => (hasPaymentsWrite && (payment.method === 'Transfer' || payment.method === 'PointOfSale') && order.payments.length === 1 ? changePaymentStatus(e) : null)" :selectable="hasPaymentsWrite"
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

                <STListItem v-if="hasTickets" class="right-description right-stack" :selectable="tickets.length > 0" @click="tickets.length > 0 ? openTickets() : null">
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
                    <STListItem v-if="(order.data.checkoutMethod as WebshopTakeoutMethod).address" class="right-description">
                        <h3 class="style-definition-label">
                            Adres
                        </h3>

                        <p class="style-definition-text">
                            {{ (order.data.checkoutMethod as WebshopTakeoutMethod).address }}
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

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncPaymentView, CartItemRow, EditPaymentView, GlobalEventBus, PriceBreakdownBox, STList, STListItem, STNavigationBar, TableActionsContextMenu, TableActionSelection, Toast, useAuth, useContext, useArrowUpDown, ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { AccessRight, BalanceItemWithPrivatePayments, OrderStatus, OrderStatusHelper, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PrivateOrder, PrivateOrderWithTickets, PrivatePayment, ProductType, RecordCategory, RecordWarning, TicketPrivate, WebshopTakeoutMethod, WebshopTicketType } from '@stamhoofd/structures';
import OrderView from './OrderView.vue';
import { Formatter } from '@stamhoofd/utility';

import { useOrganizationManager } from '@stamhoofd/networking';
import { computed, ComputedRef, onBeforeUnmount, ref, watch } from 'vue';
import { WebshopManager } from '../WebshopManager';
import { OrderActionBuilder } from './OrderActionBuilder';
import OrderTicketsView from './OrderTicketsView.vue';

const props = withDefaults(defineProps<{
    initialOrder: PrivateOrderWithTickets;
    webshopManager: WebshopManager;
    getNextOrder?: ((order: PrivateOrderWithTickets) => PrivateOrderWithTickets) | null;
    getPreviousOrder?: ((order: PrivateOrderWithTickets) => PrivateOrderWithTickets) | null;
}>(), {
    getNextOrder: null,
    getPreviousOrder: null,
});

const present = usePresent();
const pop = usePop();
const context = useContext();
const organizationManager = useOrganizationManager();
const show = useShow();

useArrowUpDown({
    down: () => goNext(),
    up: () => goBack(),
});

const webshop = computed(() => props.webshopManager.webshop);
const auth = useAuth()

props.webshopManager.loadWebshopIfNeeded().catch(console.error);

const isMissingPayments = computed(() => order.value.payments.reduce((a, b) => a + b.price, 0) !== order.value.totalToPay);
const didChangePrice = computed(() => order.value.balanceItems.flatMap(b => b.payments).length > 1 || isMissingPayments.value);

const order = computed(() => props.initialOrder) as ComputedRef<PrivateOrderWithTickets>;
const loadingTickets = ref(false);

watch(() => order.value?.balanceItems, (n: BalanceItemWithPrivatePayments[], old: BalanceItemWithPrivatePayments[]) => {
    if (n === null) {
        return;
    }

    const succeededPayments = n.flatMap(i => i.payments.map(p => p.payment)).filter(item => item.status === PaymentStatus.Succeeded);

    const oldSucceededPayments = old.flatMap(i => i.payments.map(p => p.payment)).filter(item => item.status === PaymentStatus.Succeeded);

    if (succeededPayments.length !== oldSucceededPayments.length) {
        downloadNewTickets();
    }
});

const tickets = computed(() => order.value.tickets);
const hasWarnings = computed(() => warnings.value.length > 0);
const warnings = computed(() => {
    const warnings: RecordWarning[] = [];

    for (const answer of recordAnswers.value.values()) {
        warnings.push(...answer.getWarnings());
    }

    return warnings;
});

const sortedWarnings = computed(() => {
    return warnings.value.slice().sort(RecordWarning.sort);
});

function openTickets() {
    present({
        components: [
            new ComponentWithProperties(OrderTicketsView, {
                initialOrder: order.value,
                webshopManager: props.webshopManager,
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function openPayment(payment: PrivatePayment) {
    if (!hasPaymentsWrite.value) {
        return;
    }
    present({
        components: [
            new ComponentWithProperties(AsyncPaymentView, {
                payment,
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

const hasNextOrder = computed(() => {
    if (!props.getNextOrder || !order.value) {
        return false;
    }
    return !!props.getNextOrder(order.value);
});

const hasPreviousOrder = computed(() => {
    if (!props.getPreviousOrder || !order.value) {
        return false;
    }
    return !!props.getPreviousOrder(order.value);
});

const hasPaymentsWrite = computed(() => {
    if (auth.hasAccessRight(AccessRight.OrganizationManagePayments)) {
        return true;
    }

    if (auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
        return true;
    }

    if (!webshop.value) {
        return false;
    }

    return auth.canAccessWebshop(webshop.value, PermissionLevel.Write);
});

const hasWrite = computed(() => {
    if (!webshop.value) {
        return false;
    }

    return auth.canAccessWebshop(webshop.value, PermissionLevel.Write);
});

const hasSingleTickets = computed(() => {
    if (!webshop.value) {
        return false;
    }

    return webshop.value.meta.ticketType === WebshopTicketType.SingleTicket;
});

const hasTickets = computed(() => {
    if (!webshop.value) {
        return false;
    }

    return webshop.value.meta.ticketType === WebshopTicketType.SingleTicket || !!order.value.data.cart.items.find(i => i.product.type === ProductType.Voucher || i.product.type === ProductType.Ticket);
});

const scannedCount = computed(() => {
    return tickets.value.reduce((c, ticket) => c + (ticket.scannedAt ? 1 : 0), 0);
});

const actionBuilder = new OrderActionBuilder({
    present: usePresent(),
    organizationManager: organizationManager.value,
    webshopManager: props.webshopManager,
});

const statusName = computed(() => {
    return order.value ? OrderStatusHelper.getName(order.value.status) : '';
});

const statusColor = computed(() => {
    return order.value ? OrderStatusHelper.getColor(order.value.status) : '';
});

const isCanceled = computed(() => {
    return order.value.status === OrderStatus.Canceled;
});

function showContextMenu(event: MouseEvent) {
    const el = event.currentTarget as HTMLElement;
    const bounds = el.getBoundingClientRect();

    const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
        x: bounds.left,
        y: bounds.bottom,
        xPlacement: 'right',
        yPlacement: 'bottom',
        actions: actionBuilder.getActions(),
        selection: {
            filter: {}, // todo
            fetcher: {}, // todo
            markedRows: new Map([[order.value.id, order.value]]),
            markedRowsAreSelected: true,
        } as TableActionSelection<PrivateOrderWithTickets>,
    });
    present(displayedComponent.setDisplayStyle('overlay')).catch(console.error);
}

function markAs(event: MouseEvent) {
    const el: HTMLElement = (event.currentTarget as HTMLElement).querySelector('.right') ?? event.currentTarget as HTMLElement;
    const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
        x: el.getBoundingClientRect().left + el.offsetWidth,
        y: el.getBoundingClientRect().top + el.offsetHeight,
        xPlacement: 'left',
        yPlacement: 'bottom',
        actions: actionBuilder.getStatusActions(),
        selection: {
            filter: {}, // todo
            fetcher: {}, // todo
            markedRows: new Map([[order.value.id, order.value]]),
            markedRowsAreSelected: true,
        } as TableActionSelection<PrivateOrderWithTickets>,
    });
    present(displayedComponent.setDisplayStyle('overlay')).catch(console.error);
}

function changePaymentStatus(event: TouchEvent | MouseEvent) {
    const x = (event as TouchEvent).changedTouches ? (event as TouchEvent).changedTouches[0].pageX : (event as MouseEvent).clientX;
    const y = (event as TouchEvent).changedTouches ? (event as TouchEvent).changedTouches[0].pageY : (event as MouseEvent).clientY;

    const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
        x,
        y,
        xPlacement: 'right',
        yPlacement: 'bottom',
        actions: actionBuilder.getPaymentActions(),
        selection: {
            filter: {}, // todo
            fetcher: {}, // todo
            markedRows: new Map([[order.value.id, order.value]]),
            markedRowsAreSelected: true,
        } as TableActionSelection<PrivateOrderWithTickets>,
    });
    present(displayedComponent.setDisplayStyle('overlay')).catch(console.error);
}

function editComments() {
    actionBuilder.editOrder(order.value, 'comments').catch(console.error);
}

async function onOrdersDeleted(orders: PrivateOrder[]): Promise<void> {
    if(orders.some(o => o.id === props.initialOrder.id)) {
        await pop();
    }
}

const owner = {};

function created() {
    props.webshopManager.ticketsEventBus.addListener(owner, 'fetched', tickets => onNewTickets(tickets));
    props.webshopManager.ticketPatchesEventBus.addListener(owner, 'patched', tickets => onNewTicketPatches(tickets));
    props.webshopManager.ordersEventBus.addListener(owner, 'deleted', orders => onOrdersDeleted(orders));

    if (hasTickets.value) {
        recheckTickets();
    }

    // Listen for patches in payments
    GlobalEventBus.addListener(owner, 'paymentPatch', async (payment) => {
        if (payment && payment.id && order.value.payments.find(p => p.id === payment.id as string)) {
            // Reload tickets and order
            await downloadNewOrders();
            downloadNewTickets();
        }
        return Promise.resolve();
    });
}

onBeforeUnmount(() => {
    props.webshopManager.ticketsEventBus.removeListener(owner);
    props.webshopManager.ticketPatchesEventBus.removeListener(owner);
    props.webshopManager.ordersEventBus.removeListener(owner);
});

created();

function recheckTickets() {
    if (hasTickets.value) {
        loadingTickets.value = true;
        props.webshopManager.getTicketsForOrder(order.value.id, true).then((tickets) => {
            order.value.tickets = tickets;
            loadingTickets.value = false;
        }).catch((e) => {
            console.error(e);
            loadingTickets.value = false;
        }).finally(() => {
            downloadNewTickets();
        });
    }
}

function goBack() {
    const o = props.getPreviousOrder?.(order.value);
    if (!o) {
        return;
    }
    const component = new ComponentWithProperties(OrderView, {
        initialOrder: o,
        webshopManager: props.webshopManager,
        getNextOrder: props.getNextOrder,
        getPreviousOrder: props.getPreviousOrder,
    });

    show({
        components: [component],
        replace: 1,
        reverse: true,
        animated: false,
    }).catch(console.error);
}

function goNext() {
    const o = props.getNextOrder?.(order.value);
    if (!o) {
        return;
    }
    const component = new ComponentWithProperties(OrderView, {
        initialOrder: o,
        webshopManager: props.webshopManager,
        getNextOrder: props.getNextOrder,
        getPreviousOrder: props.getPreviousOrder,
    });
    show({
        components: [component],
        replace: 1,
        animated: false,
    }).catch(console.error);
}

function getName(paymentMethod: PaymentMethod): string {
    return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(paymentMethod, order.value.data.paymentContext));
}

async function onNewTickets(tickets: TicketPrivate[]) {
    order.value.addTickets(tickets);
    return Promise.resolve();
}

function onNewTicketPatches(patches: AutoEncoderPatchType<TicketPrivate>[]) {
    order.value.addTicketPatches(patches);
    return Promise.resolve();
}

async function downloadNewOrders() {
    await props.webshopManager.fetchOrders();
}

function downloadNewTickets() {
    if (!hasTickets.value) {
        return;
    }
    props.webshopManager.fetchTickets().catch((e: Error) => {
        if (tickets.value.length === 0) {
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

const recordCategories = computed(() => {
    if (!webshop.value) {
        return [];
    }

    return RecordCategory.flattenCategoriesForAnswers(
        webshop.value.meta.recordCategories,
        [...order.value.data.recordAnswers.values()],
    );
});

const recordAnswers = computed(() => order.value.data.recordAnswers);

function createPayment() {
    const payment = PaymentGeneral.create({
        method: PaymentMethod.PointOfSale,
        status: PaymentStatus.Succeeded,
        paidAt: new Date(),
    });

    const component = new ComponentWithProperties(EditPaymentView, {
        payment,
        balanceItems: order.value.balanceItems,
        isNew: true,
        saveHandler: async (patch: AutoEncoderPatchType<PaymentGeneral>) => {
            const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
            arr.addPut(payment.patch(patch));
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/payments',
                body: arr,
                decoder: new ArrayDecoder(PaymentGeneral),
                shouldRetry: false,
            });

            // Update order
            await downloadNewOrders();
        },
    });
    present({
        components: [component],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}
</script>
