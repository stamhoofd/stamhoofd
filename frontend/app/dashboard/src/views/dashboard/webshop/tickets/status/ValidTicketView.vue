<template>
    <div ref="root" class="st-view valid-ticket-view">
        <STNavigationBar :title="$t(`ae334d5a-264a-45bc-afb7-e810e6eaf60b`)"/>

        <main v-if="!publicTicket.isSingle">
            <h1>
                <span class="icon green success"/>
                <span>{{ $t('54329610-7189-4499-9616-aae8fdab62f8') }}{{ order.number }}</span>
            </h1>

            <p v-if="order.pricePaid < order.totalToPay" class="warning-box">
                {{ $t('c37d0f21-32d5-48a9-a26d-6c165db89bff') }}
            </p>
            <p v-if="order.pricePaid > order.totalToPay" class="warning-box">
                {{ $t('9634ffcf-8d0b-44bd-b5f7-3ea3ab5a414b') }}
            </p>

            <p v-if="order.status === 'Completed'" class="warning-box">
                {{ $t('c81b7cbd-9e15-4136-b473-5285ab27c1de') }}
            </p>
            <p v-if="order.status === 'Canceled'" class="error-box">
                {{ $t('3d4e2887-7206-44a3-ba1b-cfca36cfcec2') }}
            </p>

            <button v-if="order.pricePaid !== order.totalToPay && hasPaymentsWrite && isMissingPayments" class="button text" type="button" @click="createPayment">
                <span class="icon add"/>
                <span>{{ $t('110d8149-49f6-45bb-87d5-f8f700809594') }}</span>
            </button>

            <div v-if="hasWarnings" class="hover-box container">
                <hr><ul class="member-records">
                    <li v-for="warning in sortedWarnings" :key="warning.id" :class="{ [warning.type]: true }">
                        <span :class="'icon '+warning.icon"/>
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
                <hr></div>

            <STList>
                <CartItemRow v-for="cartItem of order.data.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="order.data.cart" :webshop="webshop" :editable="false" :admin="true"/>
            </STList>

            <hr><h2>{{ $t('52a67f69-e521-4d32-a797-f4a732ae2036') }}</h2>

            <STList>
                <STListItem v-if="order.totalToPay || !webshop?.isAllFree">
                    <h3 class="style-definition-label">
                        {{ $t('e3a23f0a-f906-4433-96b1-783ab32d6e42') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.totalToPay) }}
                    </p>
                </STListItem>

                <STListItem v-if="(order.totalToPay || !webshop?.isAllFree) && (order.pricePaid > 0 && order.pricePaid !== order.totalToPay)">
                    <h3 class="style-definition-label">
                        {{ $t('2e9f80c0-51e5-4c86-a5b8-9094d8967bd2') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.pricePaid) }}
                    </p>
                </STListItem>

                <STListItem v-if="order.validAt !== null">
                    <h3 class="style-definition-label">
                        {{ $t('4a9ae395-aad5-4d47-abaf-3e1b90438f5e') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ capitalizeFirstLetter(formatDateTime(order.validAt)) }}
                    </p>
                </STListItem>

                <STListItem v-long-press="(e: Event) => (hasWrite ? markAs(e) : null)" class="right-description right-stack" :selectable="hasWrite" @click="hasWrite ? markAs($event) : null">
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
            </STList>

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
                    <STListItem v-if="(order.data.checkoutMethod as any).address" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('e6dc987c-457b-4253-9eef-db9ccdb774f1') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ (order.data.checkoutMethod as any).address }}
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
                    <STListItem v-if="order.data.administrationFee > 0" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('d0b159d0-ae10-4afc-87e5-84b6342c7468') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ formatPrice(order.data.administrationFee) }}
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
            </STList>

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="order.data"/>

            <div v-if="order.data.comments" class="container">
                <hr><h2>
                    {{ $t('1433dd52-bddb-4a28-b217-b219111a6a1c') }}
                </h2>

                <p class="pre-wrap" v-text="order.data.comments"/>
            </div>

            <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                <hr><h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                    {{ $t('8252906e-b116-4920-b62a-a83e9f05aca0') }}
                </h2>
                <h2 v-else>
                    {{ $t('4b594046-78a6-4928-a5cd-1fb7db4a6beb') }}
                </h2>

                <p class="pre-wrap" v-text="order.data.checkoutMethod.description"/>
            </div>
        </main>

        <main v-else-if="item">
            <h1>
                <span class="icon green success"/>
                <span>{{ item.product.name }}</span>
            </h1>
            <p class="ticket-secret">
                {{ ticket.secret }}
            </p>

            <p v-if="order.status === 'Canceled'" class="error-box">
                {{ $t('3d4e2887-7206-44a3-ba1b-cfca36cfcec2') }}
            </p>

            <p v-if="order.payment && order.payment.status !== 'Succeeded'" class="warning-box">
                {{ $t('6632fae1-3628-4509-9cd8-7f7816b8f398') }}
            </p>

            <p v-if="changedSeatString" class="warning-box">
                {{ changedSeatString }}
            </p>

            <div v-if="hasWarnings" class="hover-box container">
                <hr><ul class="member-records">
                    <li v-for="warning in sortedWarnings" :key="warning.id" :class="{ [warning.type]: true }">
                        <span :class="'icon '+warning.icon"/>
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
                <hr></div>

            <STList class="info">
                <STListItem v-if="item.product.dateRange">
                    <h3 class="style-definition-label">
                        {{ $t('999b580a-c487-468b-9527-e1812d170df6') }}
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
                        {{ $t('a94d3ec8-d302-4562-948b-c9b8c643295c') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ order.number }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </STList>
        </main>

        <main v-else>
            <h1>
                {{ $t('162c6c06-d097-496a-a81b-485bc3124ffc') }}
            </h1>
            <p>{{ $t('5620a10d-6800-4410-8508-6dc85521ae06') }}</p>
        </main>

        <STToolbar>
            <template #right>
                <button v-if="ticket.scannedAt" class="button secundary" type="button" @click="cancelScan">
                    {{ $t('2ceec9da-70de-497d-9199-5e9e21306096') }}
                </button>
                <button class="button primary" type="button" @click="markScanned">
                    <span class="icon qr-code"/>
                    <span>{{ $t('8322edad-eb33-4b2b-b413-457557c9a53e') }}</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncPaymentView, CartItemRow, ColorHelper, EditPaymentView, GlobalEventBus, STList, STListItem, STNavigationBar, STToolbar, TableActionsContextMenu, useContext, ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { AccessRight, OrderStatus, OrderStatusHelper, Payment, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PrivateOrder, PrivateOrderWithTickets, ProductDateRange, RecordCategory, RecordWarning, TicketPrivate, TicketPublicPrivate } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { useOrganizationManager } from '@stamhoofd/networking';
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

const hasWrite = computed(() => {
    const p = context.value.organizationPermissions;
    if (!p) {
        return false;
    }

    if (webshop.value === null) {
        return false;
    }

    return webshop.value.privateMeta.permissions.hasWriteAccess(p);
});

const hasPaymentsWrite = computed(() => {
    const p = context.value.organizationPermissions;
    if (!p) {
        return false;
    }
    if (p.hasAccessRight(AccessRight.OrganizationManagePayments)) {
        return true;
    }

    if (p.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
        return true;
    }

    if (webshop.value === null) {
        return false;
    }

    return webshop.value.privateMeta.permissions.hasWriteAccess(p);
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
        await props.webshopManager.addTicketPatch(TicketPrivate.patch({
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
        await props.webshopManager.addTicketPatch(TicketPrivate.patch({
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
            await props.webshopManager.fetchOrders();
        }
        return Promise.resolve();
    });

    props.webshopManager.ordersEventBus.addListener(owner, 'fetched', (orders: PrivateOrder[]) => {
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
    props.webshopManager.ordersEventBus.removeListener(this);
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
            await props.webshopManager.fetchOrders();
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
