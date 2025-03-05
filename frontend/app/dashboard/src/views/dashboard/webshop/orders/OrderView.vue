<template>
    <div class="st-view order-view">
        <STNavigationBar :title="$t(`Bestelling #`) + order.number">
            <template #right>
                <button v-if="hasPreviousOrder || hasNextOrder" v-tooltip="'Ga naar vorige bestelling'" type="button" class="button navigation icon arrow-up" :disabled="!hasPreviousOrder" @click="goBack"/>
                <button v-if="hasNextOrder || hasPreviousOrder" v-tooltip="'Ga naar volgende bestelling'" type="button" class="button navigation icon arrow-down" :disabled="!hasNextOrder" @click="goNext"/>
                <button v-long-press="(e: MouseEvent) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu"/>
            </template>
        </STNavigationBar>
        <main>
            <h1>
                {{ $t('54329610-7189-4499-9616-aae8fdab62f8') }}{{ order.number }}
            </h1>

            <div v-if="hasWarnings" class="hover-box container">
                <ul class="member-records">
                    <li v-for="warning in sortedWarnings" :key="warning.id" :class="{ [warning.type]: true }">
                        <span :class="'icon '+warning.icon"/>
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
                <hr></div>

            <STList v-if="webshop" class="info">
                <STListItem v-if="order.totalToPay || !webshop.isAllFree">
                    <h3 class="style-definition-label">
                        {{ $t('e3a23f0a-f906-4433-96b1-783ab32d6e42') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.totalToPay) }}
                    </p>
                </STListItem>

                <STListItem v-if="(order.totalToPay || !webshop.isAllFree) && (isMissingPayments || (order.pricePaid > 0 && order.pricePaid !== order.totalToPay))">
                    <h3 class="style-definition-label">
                        {{ $t('2e9f80c0-51e5-4c86-a5b8-9094d8967bd2') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.pricePaid) }}
                    </p>
                </STListItem>

                <STListItem v-if="order.validAt">
                    <h3 class="style-definition-label">
                        {{ $t('4a9ae395-aad5-4d47-abaf-3e1b90438f5e') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ capitalizeFirstLetter(formatDateTime(order.validAt)) }}
                    </p>
                </STListItem>

                <STListItem v-long-press="(e: MouseEvent) => (hasWrite ? markAs(e) : null)" class="right-description right-stack" :selectable="hasWrite" @click="hasWrite ? markAs($event) : null">
                    <h3 :class="'style-definition-label '+statusColor">
                        {{ $t('38b75e19-10cb-4641-88a8-f4e2e9be7576') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ statusName }}</span>
                        <span v-if="isCanceled" class="icon canceled"/>
                    </p>
                    <template v-if="hasWrite" #right>
                        <span class="icon arrow-down-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-for="(payment, index) in order.payments" :key="payment.id" v-long-press="(e: MouseEvent) => (hasPaymentsWrite && (payment.method === 'Transfer' || payment.method === 'PointOfSale') && order.payments.length === 1 ? changePaymentStatus(e) : null)" :selectable="hasPaymentsWrite" class="right-description" @click="openPayment(payment)" @contextmenu.prevent="hasPaymentsWrite && (payment.method === 'Transfer' || payment.method === 'PointOfSale') && order.payments.length === 1 ? changePaymentStatus($event) : null">
                    <h3 class="style-definition-label">
                        {{ payment.price >= 0 ? 'Betaling' : 'Terugbetaling' }} {{ order.payments.length > 1 ? index + 1 : '' }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ getName(payment.method) }}</span>
                        <span v-if="payment.status === 'Succeeded'" class="icon primary success"/>
                        <span v-else class="icon clock"/>
                    </p>

                    <template v-if="order.payments.length > 1 || hasPaymentsWrite" #right>
                        <span v-if="order.payments.length > 1">{{ formatPrice(payment.price) }}</span>
                        <span v-if="hasPaymentsWrite" class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-if="hasTickets" class="right-description right-stack" :selectable="tickets.length > 0" @click="tickets.length > 0 ? openTickets() : null">
                    <h3 v-if="tickets.length > 1 || (!hasSingleTickets && tickets.length === 0)" class="style-definition-label">
                        {{ $t('f3005a87-5877-435d-bc0e-5b4883e7ca11') }}
                    </h3>
                    <h3 v-else class="style-definition-label">
                        {{ $t('57c98fd7-1432-4b03-99f7-452b6c95a7f1') }}
                    </h3>

                    <p class="style-definition-text">
                        <template v-if="loadingTickets">
                            -
                        </template>
                        <span v-else-if="hasSingleTickets && tickets.length === 0" class="gray">
                            {{ $t('73718dc1-18ef-4bd6-abcf-551535b8147c') }}
                        </span>
                        <span v-else-if="tickets.length === 0" class="gray">
                            {{ $t('1dbfb9a1-95fd-414e-b85b-1450b70f853c') }}
                        </span>
                        <span v-else-if="hasSingleTickets && tickets.length === 1 && scannedCount === 1">
                            {{ $t('75b01a5b-d93a-4259-b27a-d00f9c4d958b') }}
                        </span>
                        <span v-else-if="hasSingleTickets && tickets.length === 1 && scannedCount === 0">
                            {{ $t('36c0a654-f22d-4ebc-8a10-54df1ab7d01c') }}
                        </span>
                        <span v-else>
                            {{ scannedCount }} / {{ tickets.length }} {{ $t('045cdbe0-e62f-4c02-bb77-fdb02d27902d') }}
                        </span>
                    </p>

                    <template v-if="tickets.length > 0" #right>
                        <span class="icon arrow-right-small"/>
                    </template>
                </STListItem>
            </STList>

            <p v-if="didChangePrice" class="warning-box">
                {{ $t('219f9843-16ae-4b04-a5e8-16b82296224b') }}
            </p>

            <p v-if="hasPaymentsWrite && isMissingPayments" class="warning-box">
                {{ $t('63ec39cc-a43f-49ab-b737-94c7fefb5a65') }}
            </p>

            <button v-if="hasPaymentsWrite && isMissingPayments" class="button text" type="button" @click="createPayment">
                <span class="icon add"/>
                <span>{{ $t('110d8149-49f6-45bb-87d5-f8f700809594') }}</span>
            </button>

            <template v-if="order.data.checkoutMethod">
                <hr><h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                    {{ $t('98fa89b2-22a5-4c47-83e0-f92da0e55b21') }}
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type === 'Delivery'">
                    {{ $t('f3e8dcfc-849d-46ba-a59c-4b342d208123') }}
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                    {{ $t('2cb37d0b-002c-434c-8334-729f3c53508c') }}
                </h2>
                <h2 v-else>
                    {{ $t('2e165a6e-64c1-4757-9fc1-0092f32c4a8f') }}
                </h2>

                <STList class="info">
                    <STListItem v-if="order.data.checkoutMethod.name" class="right-description">
                        <h3 class="style-definition-label">
                            <template v-if="order.data.checkoutMethod.type === 'Takeout'">
                                {{ $t('88fe8d3f-bdf7-435e-9974-603d08445be5') }}
                            </template>
                            <template v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                                {{ $t('257a3fd5-bd2f-4430-b268-1c85e99db41a') }}
                            </template>
                            <template v-else>
                                {{ $t('95b80805-567d-4ec0-92ed-cbbcd1564c83') }}
                            </template>
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.checkoutMethod.name }}
                        </p>
                    </STListItem>
                    <STListItem v-if="(order.data.checkoutMethod as WebshopTakeoutMethod).address" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('e6dc987c-457b-4253-9eef-db9ccdb774f1') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ (order.data.checkoutMethod as WebshopTakeoutMethod).address }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.address" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('b8166ba4-b8fb-48fe-83de-6a16572d8fc9') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.address }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.timeSlot" class="right-description">
                        <h3 class="style-definition-label">
                            <template v-if="order.data.checkoutMethod.type === 'Takeout'">
                                {{ $t('27c71009-1a4c-4fbb-be8b-a148c43342ef') }}
                            </template>
                            <template v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                                {{ $t('999b580a-c487-468b-9527-e1812d170df6') }}
                            </template>
                            <template v-else>
                                {{ $t('dab5534b-d17c-4865-ad18-7fb658c35b1f') }}
                            </template>
                        </h3>

                        <p class="style-definition-text">
                            {{ capitalizeFirstLetter(formatDate(order.data.timeSlot.date)) }}<br></p>
                    </STListItem>
                    <STListItem v-if="order.data.deliveryPrice > 0" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('c9b5231b-4f72-4afd-8be3-54a4b92bc3e4') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ formatPrice(order.data.deliveryPrice) }}
                        </p>
                    </STListItem>
                </STList>
            </template>

            <hr><h2>{{ $t('4596bd3a-5be6-4cd3-a489-8f3a566b9302') }}</h2>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('d32893b7-c9b0-4ea3-a311-90d29f2c0cf3') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ order.data.customer.name }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('0be79160-b242-44dd-94f0-760093f7f9f2') }}
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
                        {{ $t('1433dd52-bddb-4a28-b217-b219111a6a1c') }}
                    </h3>

                    <p class="style-definition-text pre-wrap" v-text="order.data.comments"/>
                    <template v-if="hasWrite" #right>
                        <span class="icon edit"/>
                    </template>
                </STListItem>
            </STList>

            <div v-if="!order.data.comments && hasWrite" class="container">
                <button class="button text" type="button" @click="editComments()">
                    <span class="icon edit"/>
                    <span>{{ $t('1433dd52-bddb-4a28-b217-b219111a6a1c') }}</span>
                </button>
            </div>

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="order.data"/>

            <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                <hr><h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                    {{ $t('8252906e-b116-4920-b62a-a83e9f05aca0') }}
                </h2>
                <h2 v-else>
                    {{ $t('4b594046-78a6-4928-a5cd-1fb7db4a6beb') }}
                </h2>

                <p class="pre-wrap" v-text="order.data.checkoutMethod.description"/>
            </div>

            <hr><p v-for="code of order.data.discountCodes" :key="code.id" class="discount-box icon label">
                <span>{{ $t('2f4e2886-2c75-47d7-8bc4-5ace1a8d3a33') }} <span class="style-discount-code">{{ code.code }}</span></span>
            </p>

            <STList>
                <CartItemRow v-for="cartItem of order.data.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="order.data.cart" :webshop="webshop" :editable="false" :admin="true"/>
            </STList>

            <hr><PriceBreakdownBox :price-breakdown="order.data.priceBreakown"/>
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
const auth = useAuth();

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
    if (orders.some(o => o.id === props.initialOrder.id)) {
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

    return RecordCategory.flattenCategories(
        webshop.value.meta.recordCategories,
        order.value.data,
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
