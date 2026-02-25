<template>
    <div class="st-view order-view">
        <STNavigationBar :title="$t(`e0f1bd7f-332f-4c99-adab-35a7e7481cf9`) + order.number">
            <template #right>
                <button v-if="hasPreviousOrder || hasNextOrder" type="button" class="button icon arrow-up" :disabled="!hasPreviousOrder" :v-tooltip="$t('bd66e295-2748-40da-a8e9-0e6e48584033')" @click="goBack" />
                <button v-if="hasNextOrder || hasPreviousOrder" type="button" class="button icon arrow-down" :disabled="!hasNextOrder" :v-tooltip="$t('4428ee36-a994-468c-b8a1-22ed6e8bde58')" @click="goNext" />
                <button v-long-press="(e: MouseEvent) => showContextMenu(e)" class="button icon more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>
        <main>
            <h1>
                {{ $t('1a2a842e-4f98-4818-911b-c9634aca4214') }}{{ order.number }}
            </h1>

            <div v-if="hasWarnings" class="hover-box container">
                <ul class="member-records">
                    <li v-for="warning in sortedWarnings" :key="warning.id" :class="{ [warning.type]: true }">
                        <span :class="'icon '+warning.icon" />
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
                <hr>
            </div>

            <STList v-if="webshop" class="info">
                <STListItem v-if="order.totalToPay || !webshop.isAllFree">
                    <h3 class="style-definition-label">
                        {{ $t('6880cc0a-c1a2-4c94-8e2f-ab6fd096d309') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.totalToPay) }}
                    </p>
                </STListItem>

                <STListItem v-if="(order.totalToPay || !webshop.isAllFree) && (isMissingPayments || (order.pricePaid > 0 && order.pricePaid !== order.totalToPay))">
                    <h3 class="style-definition-label">
                        {{ $t('25c803f0-6b45-42aa-9b88-573e3706b8bb') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.pricePaid) }}
                    </p>
                </STListItem>

                <STListItem v-if="order.validAt">
                    <h3 class="style-definition-label">
                        {{ $t('d1d52570-86b9-4edd-82c4-ccc1d759c6dc') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ capitalizeFirstLetter(formatDateTime(order.validAt)) }}
                    </p>
                </STListItem>

                <STListItem v-long-press="(e: MouseEvent) => (hasWrite ? markAs(e) : null)" class="right-description right-stack" :selectable="hasWrite" @click="hasWrite ? markAs($event) : null">
                    <h3 :class="'style-definition-label '+statusColor">
                        {{ $t('e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ statusName }}</span>
                        <span v-if="isCanceled" class="icon canceled" />
                    </p>
                    <template v-if="hasWrite" #right>
                        <span class="icon arrow-down-small gray" />
                    </template>
                </STListItem>

                <STListItem v-for="(payment, index) in order.payments" :key="payment.id" v-long-press="(e: MouseEvent) => (hasPaymentsWrite && (payment.method === 'Transfer' || payment.method === 'PointOfSale') && order.payments.length === 1 ? changePaymentStatus(e) : null)" :selectable="hasPaymentsWrite" class="right-description" @click="openPayment(payment)" @contextmenu.prevent="hasPaymentsWrite && (payment.method === 'Transfer' || payment.method === 'PointOfSale') && order.payments.length === 1 ? changePaymentStatus($event) : null">
                    <h3 class="style-definition-label">
                        {{ payment.price >= 0 ? 'Betaling' : 'Terugbetaling' }} {{ order.payments.length > 1 ? index + 1 : '' }}
                    </h3>
                    <p class="style-definition-text with-icons">
                        <span>{{ getName(payment.method) }}</span>
                        <span v-if="payment.status === 'Succeeded'" class="icon primary success small" />
                        <span v-else class="icon clock small" />
                    </p>

                    <template v-if="order.payments.length > 1 || hasPaymentsWrite" #right>
                        <span v-if="order.payments.length > 1">{{ formatPrice(payment.price) }}</span>
                        <span v-if="hasPaymentsWrite" class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="hasTickets" class="right-description right-stack" :selectable="tickets.length > 0" @click="tickets.length > 0 ? openTickets() : null">
                    <h3 v-if="tickets.length > 1 || (!hasSingleTickets && tickets.length === 0)" class="style-definition-label">
                        {{ $t('b40d200c-4265-4d58-a7f4-7c2498b062b9') }}
                    </h3>
                    <h3 v-else class="style-definition-label">
                        {{ $t('de971042-551d-43d2-ab47-e76132156887') }}
                    </h3>

                    <p class="style-definition-text">
                        <template v-if="loadingTickets">
                            -
                        </template>
                        <span v-else-if="hasSingleTickets && tickets.length === 0" class="gray">
                            {{ $t('0c609cc0-e0da-43b0-9390-3e70e1407475') }}
                        </span>
                        <span v-else-if="tickets.length === 0" class="gray">
                            {{ $t('57bbb3fe-8c53-4aab-b103-38d86df4de84') }}
                        </span>
                        <span v-else-if="hasSingleTickets && tickets.length === 1 && scannedCount === 1">
                            {{ $t('044f91f3-91b5-4109-ad8d-3fea6c0c92e2') }}
                        </span>
                        <span v-else-if="hasSingleTickets && tickets.length === 1 && scannedCount === 0">
                            {{ $t('c1bb5197-b80f-482e-aac8-db8f08e37108') }}
                        </span>
                        <span v-else>
                            {{ scannedCount }} / {{ tickets.length }} {{ $t('c22c23f8-54d9-4116-8ad0-8766aeb46bea') }}
                        </span>
                    </p>

                    <template v-if="tickets.length > 0" #right>
                        <span class="icon arrow-right-small" />
                    </template>
                </STListItem>
            </STList>

            <p v-if="didChangePrice" class="warning-box">
                {{ $t('c1ebdccb-6610-4947-a14d-0731c9cb2dc6') }}
            </p>

            <p v-if="hasPaymentsWrite && isMissingPayments" class="warning-box">
                {{ $t('6cc7c2e8-bb92-4495-9915-c0fe83631379') }}
            </p>

            <button v-if="hasPaymentsWrite && isMissingPayments" class="button text" type="button" @click="createPayment">
                <span class="icon add" />
                <span>{{ $t('515e4985-a826-42fc-9dd0-fc168da16f46') }}</span>
            </button>

            <template v-if="order.data.checkoutMethod">
                <hr><h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                    {{ $t('edd72e8b-76de-45df-93a0-ecc72efb849a') }}
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type === 'Delivery'">
                    {{ $t('acde7540-a0b2-4eaf-88af-2d92851f73de') }}
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                    {{ $t('25e67f34-649f-4743-9cdd-d2a81d252daf') }}
                </h2>
                <h2 v-else>
                    {{ $t('8baa8f22-c18c-4de7-85b1-99a85509019b') }}
                </h2>

                <STList class="info">
                    <STListItem v-if="order.data.checkoutMethod.name" class="right-description">
                        <h3 class="style-definition-label">
                            <template v-if="order.data.checkoutMethod.type === 'Takeout'">
                                {{ $t('8113733b-00ea-42ae-8829-6056774a8be0') }}
                            </template>
                            <template v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                                {{ $t('7eec15d0-4d60-423f-b860-4f3824271578') }}
                            </template>
                            <template v-else>
                                {{ $t('5562135d-197d-4251-ada8-ffe747622e7b') }}
                            </template>
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.checkoutMethod.name }}
                        </p>
                    </STListItem>
                    <STListItem v-if="(order.data.checkoutMethod as WebshopTakeoutMethod).address" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('f7e792ed-2265-41e9-845f-e3ce0bc5da7c') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ (order.data.checkoutMethod as WebshopTakeoutMethod).address }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.address" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('8a910c54-1b2d-4963-9128-2cab93b0151b') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.address }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.timeSlot" class="right-description">
                        <h3 class="style-definition-label">
                            <template v-if="order.data.checkoutMethod.type === 'Takeout'">
                                {{ $t('856550aa-05af-45fc-8477-51ed1f719432') }}
                            </template>
                            <template v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                                {{ $t('13081716-3941-44b8-87b4-398ab2288419') }}
                            </template>
                            <template v-else>
                                {{ $t('cf7b982a-add0-4dc7-bbf9-f0c2477fa1e0') }}
                            </template>
                        </h3>

                        <p class="style-definition-text">
                            {{ capitalizeFirstLetter(formatDate(order.data.timeSlot.date)) }}<br>
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.deliveryPrice > 0" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('482bd766-39fa-4340-91b4-ae22a23d5fa5') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ formatPrice(order.data.deliveryPrice) }}
                        </p>
                    </STListItem>
                </STList>
            </template>

            <hr><h2>{{ $t('f4d00d5c-77c9-41dd-9689-a447c7977449') }}</h2>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('17edcdd6-4fb2-4882-adec-d3a4f43a1926') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ order.data.customer.name }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('7400cdce-dfb4-40e7-996b-4817385be8d8') }}
                    </h3>
                    <p class="style-definition-text">
                        <EmailAddress :email="order.data.customer.email" />
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
                        {{ $t('7f3af27c-f057-4ce3-8385-36dfb99745e8') }}
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
                    <span>{{ $t('7f3af27c-f057-4ce3-8385-36dfb99745e8') }}</span>
                </button>
            </div>

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="order.data" />

            <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                <hr><h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                    {{ $t('038031a7-0942-493a-9eb5-0cea9bb487b0') }}
                </h2>
                <h2 v-else>
                    {{ $t('22af7a31-3e7c-43ee-aa6f-d6638719caed') }}
                </h2>

                <p class="pre-wrap" v-text="order.data.checkoutMethod.description" />
            </div>

            <hr><p v-for="code of order.data.discountCodes" :key="code.id" class="discount-box icon label">
                <span>{{ $t('46a3962f-7d21-4cf4-b3a9-bfec8007e68a') }} <span class="style-discount-code">{{ code.code }}</span></span>
            </p>

            <STList>
                <CartItemRow v-for="cartItem of order.data.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="order.data.cart" :webshop="webshop" :editable="false" :admin="true" />
            </STList>

            <hr><PriceBreakdownBox :price-breakdown="order.data.priceBreakown" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncPaymentView, CartItemRow, EditPaymentView, EmailAddress, GlobalEventBus, PriceBreakdownBox, STList, STListItem, STNavigationBar, TableActionsContextMenu, TableActionSelection, Toast, useArrowUpDown, useAuth, useContext, ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { AccessRight, BalanceItemWithPrivatePayments, LimitedFilteredRequest, OrderStatus, OrderStatusHelper, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PrivateOrder, PrivateOrderWithTickets, PrivatePayment, ProductType, RecordCategory, RecordWarning, TicketPrivate, WebshopTakeoutMethod, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import OrderView from './OrderView.vue';

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
            filter: new LimitedFilteredRequest({
                filter: {
                    id: props.initialOrder.id,
                },
                limit: 2,
            }),
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
    props.webshopManager.tickets.eventBus.addListener(owner, 'fetched', tickets => onNewTickets(tickets));
    props.webshopManager.tickets.patchesEventBus.addListener(owner, 'patched', tickets => onNewTicketPatches(tickets));
    props.webshopManager.orders.eventBus.addListener(owner, 'deleted', orders => onOrdersDeleted(orders));

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
    props.webshopManager.tickets.eventBus.removeListener(owner);
    props.webshopManager.tickets.patchesEventBus.removeListener(owner);
    props.webshopManager.orders.eventBus.removeListener(owner);
});

created();

function recheckTickets() {
    if (hasTickets.value) {
        loadingTickets.value = true;
        props.webshopManager.tickets.getForOrder(order.value.id, true).then((tickets) => {
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
    await props.webshopManager.orders.fetchAllUpdated();
}

function downloadNewTickets() {
    if (!hasTickets.value) {
        return;
    }
    props.webshopManager.tickets.fetchAllUpdated().catch((e: Error) => {
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
        customers: [
            order.value.data.customer.toPaymentCustomer(),
        ],
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
