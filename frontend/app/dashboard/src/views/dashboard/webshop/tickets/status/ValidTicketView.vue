<template>
    <div ref="root" class="st-view valid-ticket-view">
        <STNavigationBar :title="$t(`%WB`)" />

        <main v-if="!publicTicket.isSingle">
            <h1>
                <span class="icon green success" />
                <span>{{ $t('%x3') }}{{ order.number }}</span>
            </h1>

            <p v-if="order.pricePaid < order.totalToPay" class="warning-box">
                {{ $t('%W0') }}
            </p>
            <p v-if="order.pricePaid > order.totalToPay" class="warning-box">
                {{ $t('%W1') }}
            </p>

            <p v-if="order.status === 'Completed'" class="warning-box">
                {{ $t('%W2') }}
            </p>
            <p v-if="order.status === 'Canceled'" class="error-box">
                {{ $t('%W3') }}
            </p>

            <button v-if="order.pricePaid !== order.totalToPay && hasPaymentsWrite && isMissingPayments" class="button text" type="button" @click="createPayment">
                <span class="icon add" />
                <span>{{ $t('%VW') }}</span>
            </button>

            <div v-if="hasWarnings" class="hover-box container">
                <hr><ul class="member-records">
                    <li v-for="warning in sortedWarnings" :key="warning.id" :class="{ [warning.type]: true }">
                        <span :class="'icon '+warning.icon" />
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
                <hr>
            </div>

            <STList>
                <CartItemRow v-for="cartItem of order.data.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="order.data.cart" :webshop="webshop" :editable="false" :admin="true" />
            </STList>

            <hr><h2>{{ $t('%W4') }}</h2>

            <STList>
                <STListItem v-if="order.totalToPay || !webshop?.isAllFree">
                    <h3 class="style-definition-label">
                        {{ $t('%VQ') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.totalToPay) }}
                    </p>
                </STListItem>

                <STListItem v-if="(order.totalToPay || !webshop?.isAllFree) && (order.pricePaid > 0 && order.pricePaid !== order.totalToPay)">
                    <h3 class="style-definition-label">
                        {{ $t('%Ml') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.pricePaid) }}
                    </p>
                </STListItem>

                <STListItem v-if="order.validAt !== null">
                    <h3 class="style-definition-label">
                        {{ $t('%VR') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ capitalizeFirstLetter(formatDateTime(order.validAt)) }}
                    </p>
                </STListItem>

                <STListItem v-long-press="(e: Event) => (hasWrite ? markAs(e) : null)" class="right-description right-stack" :selectable="hasWrite" @click="hasWrite ? markAs($event) : null">
                    <h3 :class="'style-definition-label '+statusColor">
                        {{ $t('%1A') }}
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
            </STList>

            <template v-if="order.data.checkoutMethod">
                <hr><h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                    {{ $t('%xG') }}
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type === 'Delivery'">
                    {{ $t('%VX') }}
                </h2>
                <h2 v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                    {{ $t('%VY') }}
                </h2>
                <h2 v-else>
                    {{ $t('%VZ') }}
                </h2>

                <STList class="info">
                    <STListItem v-if="order.data.checkoutMethod.name" class="right-description">
                        <h3 class="style-definition-label">
                            <template v-if="order.data.checkoutMethod.type === 'Takeout'">
                                {{ $t('%Uq') }}
                            </template>
                            <template v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                                {{ $t('%TW') }}
                            </template>
                            <template v-else>
                                {{ $t('%Va') }}
                            </template>
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.checkoutMethod.name }}
                        </p>
                    </STListItem>
                    <STListItem v-if="(order.data.checkoutMethod as any).address" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('%Cn') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ (order.data.checkoutMethod as any).address }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.address" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('%Us') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ order.data.address }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.timeSlot" class="right-description">
                        <h3 class="style-definition-label">
                            <template v-if="order.data.checkoutMethod.type === 'Takeout'">
                                {{ $t('%Vb') }}
                            </template>
                            <template v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                                {{ $t('%Vc') }}
                            </template>
                            <template v-else>
                                {{ $t('%Vd') }}
                            </template>
                        </h3>

                        <p class="style-definition-text">
                            {{ capitalizeFirstLetter(formatDate(order.data.timeSlot.date)) }}<br>
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.deliveryPrice > 0" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('%Sn') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ formatPrice(order.data.deliveryPrice) }}
                        </p>
                    </STListItem>
                    <STListItem v-if="order.data.administrationFee > 0" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('%xK') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ formatPrice(order.data.administrationFee) }}
                        </p>
                    </STListItem>
                </STList>
            </template>

            <hr><h2>{{ $t('%zM') }}</h2>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%Gq') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ order.data.customer.name }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%1FK') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ order.data.customer.email }}
                    </p>
                </STListItem>

                <STListItem v-if="order.data.customer.phone">
                    <h3 class="style-definition-label">
                        {{ $t("%2k") }}
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

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="order.data" />

            <div v-if="order.data.comments" class="container">
                <hr><h2>
                    {{ $t('%Ve') }}
                </h2>

                <p class="pre-wrap" v-text="order.data.comments" />
            </div>

            <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                <hr><h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                    {{ $t('%Vf') }}
                </h2>
                <h2 v-else>
                    {{ $t('%Vg') }}
                </h2>

                <p class="pre-wrap" v-text="order.data.checkoutMethod.description" />
            </div>
        </main>

        <main v-else-if="item">
            <h1>
                <span class="icon green success" />
                <span>{{ item.product.name }}</span>
            </h1>
            <p class="ticket-secret">
                {{ ticket.secret }}
            </p>

            <p v-if="order.status === 'Canceled'" class="error-box">
                {{ $t('%W3') }}
            </p>

            <p v-if="order.payment && order.payment.status !== 'Succeeded'" class="warning-box">
                {{ $t('%W5') }}
            </p>

            <p v-if="changedSeatString" class="warning-box">
                {{ changedSeatString }}
            </p>

            <div v-if="hasWarnings" class="hover-box container">
                <hr><ul class="member-records">
                    <li v-for="warning in sortedWarnings" :key="warning.id" :class="{ [warning.type]: true }">
                        <span :class="'icon '+warning.icon" />
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
                <hr>
            </div>

            <STList class="info">
                <STListItem v-if="item.product.dateRange">
                    <h3 class="style-definition-label">
                        {{ $t('%Vc') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateRange(item.product.dateRange) }}
                    </p>
                </STListItem>

                <STListItem v-if="indexDescription.length">
                    <div class="split-info">
                        <div v-for="(row, index) in indexDescription" :key="index">
                            <h3 class="style-definition-label">
                                {{ row.title }}
                            </h3>
                            <p class="style-definition-text">
                                {{ row.value }}
                            </p>
                        </div>
                    </div>
                </STListItem>

                <STListItem v-if="item.product.prices.length > 1">
                    <p class="style-definition-text">
                        {{ item.productPrice.name }}
                    </p>
                </STListItem>

                <STListItem v-for="answer of item.fieldAnswers" :key="answer.field.id">
                    <h3 class="style-definition-label">
                        {{ answer.field.name }}
                    </h3>
                    <p class="style-definition-text">
                        {{ answer.answer }}
                    </p>
                </STListItem>

                <STListItem v-for="option of item.options" :key="option.optionMenu.id">
                    <h3 class="style-definition-label">
                        {{ option.optionMenu.name }}
                    </h3>
                    <p class="style-definition-text">
                        {{ option.option.name }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" @click="openOrder">
                    <h3 class="style-definition-label">
                        {{ $t('%W6') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ order.number }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>

        <main v-else>
            <h1>
                {{ $t('%W7') }}
            </h1>
            <p>{{ $t('%W8') }}</p>
        </main>

        <STToolbar>
            <template #right>
                <button v-if="ticket.scannedAt" class="button secundary" type="button" @click="cancelScan">
                    {{ $t('%W9') }}
                </button>
                <button class="button primary" type="button" @click="markScanned">
                    <span class="icon qr-code" />
                    <span>{{ $t('%WA') }}</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import AsyncPaymentView from '@stamhoofd/components/payments/AsyncPaymentView.vue';
import CartItemRow from '@stamhoofd/components/views/CartItemRow.vue';
import { ColorHelper } from '@stamhoofd/components/ColorHelper.ts';
import EditPaymentView from '@stamhoofd/components/payments/EditPaymentView.vue';
import { GlobalEventBus } from '@stamhoofd/components/EventBus.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import TableActionsContextMenu from '@stamhoofd/components/tables/TableActionsContextMenu.vue';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import ViewRecordCategoryAnswersBox from '@stamhoofd/components/records/components/ViewRecordCategoryAnswersBox.vue';
import { AccessRight, OrderStatus, OrderStatusHelper, Payment, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PrivateOrder, PrivateOrderWithTickets, ProductDateRange, RecordCategory, RecordWarning, TicketPrivate, TicketPublicPrivate } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { OrderActionBuilder } from '../../orders/OrderActionBuilder';
import OrderView from '../../orders/OrderView.vue';
import { WebshopManager } from '../../WebshopManager';

const props = defineProps<{
    webshopManager: WebshopManager;
    ticket: TicketPrivate | TicketPublicPrivate;
    order: PrivateOrder;
}>();

const root = ref<HTMLElement | null>(null);

watch(root, (el) => {
    if (el) {
        ColorHelper.setColor('#0CBB69', el);
    }
});

const present = usePresent();
const pop = usePop();
const context = useContext();
const organizationManager = useOrganizationManager();

const webshop = computed(() => props.webshopManager.webshop);
props.webshopManager.loadWebshopIfNeeded(false, true).catch(console.error);

const recordAnswers = computed(() => props.order.data.recordAnswers);
const isMissingPayments = computed(() => props.order.payments.reduce((a, b) => a + b.price, 0) !== props.order.totalToPay);
const hasWarnings = computed(() => warnings.value.length > 0);
const publicTicket = computed(() => props.ticket.getPublic(props.order));
const indexDescription = computed(() => publicTicket.value.getIndexDescription(props.webshopManager.preview));
const changedSeatString = computed(() => webshop.value ? publicTicket.value.getChangedSeatString(webshop.value, false) : '');
const warnings = computed(() => {
    const warnings: RecordWarning[] = [];

    for (const answer of recordAnswers.value.values()) {
        warnings.push(...answer.getWarnings());
    }

    return warnings;
});

const sortedWarnings = computed(() => warnings.value.slice().sort(RecordWarning.sort));
const isCanceled = computed(() => props.order.status === OrderStatus.Canceled);
const item = computed(() => publicTicket.value.isSingle ? publicTicket.value.items[0] : null);

function formatDateRange(dateRange: ProductDateRange) {
    return Formatter.capitalizeFirstLetter(dateRange.toString());
}

function getName(paymentMethod: PaymentMethod): string {
    return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(paymentMethod));
}

const actionBuilder = computed(() => new OrderActionBuilder({
    present: usePresent(),
    organizationManager: organizationManager.value,
    webshopManager: props.webshopManager,
}));

const statusName = computed(() => OrderStatusHelper.getName(props.order.status));

const statusColor = computed(() => OrderStatusHelper.getColor(props.order.status));
const auth = useAuth();

const hasWrite = computed(() => {
    return auth.canAccessWebshop(webshop.value ?? props.webshopManager.preview, PermissionLevel.Write);
});

const hasPaymentsWrite = computed(() => {
    if (auth.hasAccessRight(AccessRight.OrganizationManagePayments)) {
        return true;
    }

    if (auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
        return true;
    }

    return auth.canAccessWebshop(webshop.value ?? props.webshopManager.preview, PermissionLevel.Write);
});

function openPayment(payment: Payment) {
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

function markAs(event: Event) {
    const el: HTMLElement = (event.currentTarget as HTMLElement).querySelector('.right') ?? event.currentTarget as HTMLElement;
    const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
        x: el.getBoundingClientRect().left + el.offsetWidth,
        y: el.getBoundingClientRect().top + el.offsetHeight,
        xPlacement: 'left',
        yPlacement: 'bottom',
        actions: actionBuilder.value.getStatusActions(),
        // todo: selection
    });
    present(displayedComponent.setDisplayStyle('overlay')).catch(console.error);
}

function changePaymentStatus(event: Event) {
    const el: HTMLElement = (event.currentTarget as HTMLElement).querySelector('.right') ?? event.currentTarget as HTMLElement;
    const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
        x: el.getBoundingClientRect().left + el.offsetWidth,
        y: el.getBoundingClientRect().top + el.offsetHeight,
        xPlacement: 'left',
        yPlacement: 'bottom',
        actions: actionBuilder.value.getPaymentActions(),
        // todo: selection
    });
    present(displayedComponent.setDisplayStyle('overlay')).catch(console.error);
}

async function cancelScan() {
    if (props.ticket.scannedAt) {
        await props.webshopManager.tickets.putPatch(TicketPrivate.patch({
            id: props.ticket.id,
            secret: props.ticket.secret, // needed for lookups
            scannedAt: null,
            scannedBy: null,
        }));
    }
    pop({ force: true })?.catch(console.error);
}

async function markScanned() {
    if (!props.ticket.scannedAt) {
        await props.webshopManager.tickets.putPatch(TicketPrivate.patch({
            id: props.ticket.id,
            secret: props.ticket.secret, // needed for lookups
            scannedAt: new Date(),
            scannedBy: context.value.user?.firstName ?? null,
        }));
    }

    pop({ force: true })?.catch(console.error);
}

const recordCategories = computed(() => {
    if (webshop.value === null) {
        return [];
    }

    return RecordCategory.flattenCategories(
        webshop.value.meta.recordCategories,
        props.order.data,
    );
});

function openOrder() {
    present({
        components: [
            new ComponentWithProperties(OrderView, {
                initialOrder: PrivateOrderWithTickets.create(props.order),
                webshopManager: props.webshopManager,
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

const owner = {};

function created() {
    // Listen for patches in payments
    GlobalEventBus.addListener(owner, 'paymentPatch', async (payment) => {
        if (payment && payment.id && props.order.payments.find(p => p.id === payment.id as string)) {
            await props.webshopManager.orders.fetchAllUpdated();
        }
        return Promise.resolve();
    });

    props.webshopManager.orders.eventBus.addListener(owner, 'fetched', (orders: PrivateOrder[]) => {
        for (const order of orders) {
            if (order.id === props.order.id) {
                props.order.deepSet(order);
            }
        }
        return Promise.resolve();
    });
}

created();

onBeforeUnmount(() => {
    props.webshopManager.orders.eventBus.removeListener(this);
});

function createPayment() {
    const payment = PaymentGeneral.create({
        method: PaymentMethod.PointOfSale,
        status: PaymentStatus.Succeeded,
        paidAt: new Date(),
    });

    const component = new ComponentWithProperties(EditPaymentView, {
        payment,
        balanceItems: props.order.balanceItems,
        isNew: true,
        customers: [
            props.order.data.customer.toPaymentCustomer(),
        ],
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
            await props.webshopManager.orders.fetchAllUpdated();
        },
    });

    present({
        components: [component],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.valid-ticket-view {
    // background: $color-success-background;
    // --color-current-background: #{$color-success-background};
    //--color-current-background-shade: #{$color-success-background-shade};

    // color: $color-success-dark;

    > main {
        > h1 {
            text-align: center;
            padding-bottom: 0 !important;

            span {
                display: block;

                &.icon {
                    display: inline-block;
                    font-size: 64px;
                    width: 64px;
                }
            }
        }
    }

    .ticket-secret {
        text-align: center;
        color: $color-gray-text;
        font-size: 10px;
        font-weight: bold;
        padding-bottom: 20px;
        padding-top: 5px;
    }

    .pre-wrap {
        @extend .style-description;
        white-space: pre-wrap;
    }
}
</style>
