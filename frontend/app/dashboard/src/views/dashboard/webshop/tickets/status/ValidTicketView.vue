<template>
    <div ref="root" class="st-view valid-ticket-view">
        <STNavigationBar :title="$t(`a1761504-f92f-4ef8-b2e1-fd66dfb1107b`)" />

        <main v-if="!publicTicket.isSingle">
            <h1>
                <span class="icon green success" />
                <span>{{ $t('1a2a842e-4f98-4818-911b-c9634aca4214') }}{{ order.number }}</span>
            </h1>

            <p v-if="order.pricePaid < order.totalToPay" class="warning-box">
                {{ $t('cb6d8561-3187-4b56-bb71-fe6ddaba642f') }}
            </p>
            <p v-if="order.pricePaid > order.totalToPay" class="warning-box">
                {{ $t('c66e68e3-1a62-4218-97a8-bbb7b4f46fc1') }}
            </p>

            <p v-if="order.status === 'Completed'" class="warning-box">
                {{ $t('10529c9f-43f8-40f1-b2bf-b59d57caa766') }}
            </p>
            <p v-if="order.status === 'Canceled'" class="error-box">
                {{ $t('9a6904ac-2c29-443a-9e73-7c7588c626be') }}
            </p>

            <button v-if="order.pricePaid !== order.totalToPay && hasPaymentsWrite && isMissingPayments" class="button text" type="button" @click="createPayment">
                <span class="icon add" />
                <span>{{ $t('515e4985-a826-42fc-9dd0-fc168da16f46') }}</span>
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

            <hr><h2>{{ $t('73cfeb52-162d-4e87-9ed5-1076bb992484') }}</h2>

            <STList>
                <STListItem v-if="order.totalToPay || !webshop?.isAllFree">
                    <h3 class="style-definition-label">
                        {{ $t('6880cc0a-c1a2-4c94-8e2f-ab6fd096d309') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.totalToPay) }}
                    </p>
                </STListItem>

                <STListItem v-if="(order.totalToPay || !webshop?.isAllFree) && (order.pricePaid > 0 && order.pricePaid !== order.totalToPay)">
                    <h3 class="style-definition-label">
                        {{ $t('25c803f0-6b45-42aa-9b88-573e3706b8bb') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.pricePaid) }}
                    </p>
                </STListItem>

                <STListItem v-if="order.validAt !== null">
                    <h3 class="style-definition-label">
                        {{ $t('d1d52570-86b9-4edd-82c4-ccc1d759c6dc') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ capitalizeFirstLetter(formatDateTime(order.validAt)) }}
                    </p>
                </STListItem>

                <STListItem v-long-press="(e: Event) => (hasWrite ? markAs(e) : null)" class="right-description right-stack" :selectable="hasWrite" @click="hasWrite ? markAs($event) : null">
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
                    <STListItem v-if="(order.data.checkoutMethod as any).address" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('f7e792ed-2265-41e9-845f-e3ce0bc5da7c') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ (order.data.checkoutMethod as any).address }}
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
                    <STListItem v-if="order.data.administrationFee > 0" class="right-description">
                        <h3 class="style-definition-label">
                            {{ $t('be98be36-f796-4f96-b054-4d2a09be3d79') }}
                        </h3>

                        <p class="style-definition-text">
                            {{ formatPrice(order.data.administrationFee) }}
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

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="order.data" />

            <div v-if="order.data.comments" class="container">
                <hr><h2>
                    {{ $t('7f3af27c-f057-4ce3-8385-36dfb99745e8') }}
                </h2>

                <p class="pre-wrap" v-text="order.data.comments" />
            </div>

            <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                <hr><h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                    {{ $t('038031a7-0942-493a-9eb5-0cea9bb487b0') }}
                </h2>
                <h2 v-else>
                    {{ $t('22af7a31-3e7c-43ee-aa6f-d6638719caed') }}
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
                {{ $t('9a6904ac-2c29-443a-9e73-7c7588c626be') }}
            </p>

            <p v-if="order.payment && order.payment.status !== 'Succeeded'" class="warning-box">
                {{ $t('412bb2c5-0f77-4168-ad8d-2e27ba35020b') }}
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
                        {{ $t('13081716-3941-44b8-87b4-398ab2288419') }}
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
                        {{ $t('26f63e2b-14a5-4120-96e8-409c93ec4677') }}
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
                {{ $t('8c153fdb-d103-4f8d-8ad1-89cae3e9869d') }}
            </h1>
            <p>{{ $t('881bf207-5632-4254-90e2-3e1f691740ea') }}</p>
        </main>

        <STToolbar>
            <template #right>
                <button v-if="ticket.scannedAt" class="button secundary" type="button" @click="cancelScan">
                    {{ $t('44cd24c3-8214-434c-a123-923d6c606a69') }}
                </button>
                <button class="button primary" type="button" @click="markScanned">
                    <span class="icon qr-code" />
                    <span>{{ $t('b158e8e9-4f84-4f76-9c4c-ea2ffd1d882f') }}</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncPaymentView, CartItemRow, ColorHelper, EditPaymentView, GlobalEventBus, STList, STListItem, STNavigationBar, STToolbar, TableActionsContextMenu, useAuth, useContext, ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { AccessRight, OrderStatus, OrderStatusHelper, Payment, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PrivateOrder, PrivateOrderWithTickets, ProductDateRange, RecordCategory, RecordWarning, TicketPrivate, TicketPublicPrivate } from '@stamhoofd/structures';
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
        customers: [
            props.order.data.customer.toPaymentCustomer()
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
