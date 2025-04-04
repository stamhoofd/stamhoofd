<template>
    <div ref="root" class="st-view valid-ticket-view">
        <STNavigationBar title="Geldig ticket" />

        <main v-if="!publicTicket.isSingle">
            <h1>
                <span class="icon green success" />
                <span>Bestelling #{{ order.number }}</span>
            </h1>

            <p v-if="order.pricePaid < order.totalToPay" class="warning-box">
                Deze bestelling werd nog niet (volledig) betaald.
            </p>
            <p v-if="order.pricePaid > order.totalToPay" class="warning-box">
                Er werd te veel betaald voor de bestelling (waarschijnlijk gewijzigd na betaling). Er is een terugbetaling nodig.
            </p>

            <p v-if="order.status === 'Completed'" class="warning-box">
                Deze bestelling werd al als voltooid gemarkeerd
            </p>
            <p v-if="order.status === 'Canceled'" class="error-box">
                Deze bestelling werd geannuleerd
            </p>

            <button v-if="order.pricePaid !== order.totalToPay && hasPaymentsWrite && isMissingPayments" class="button text" type="button" @click="createPayment">
                <span class="icon add" />
                <span>Betaling / terugbetaling registreren</span>
            </button>

            <div v-if="hasWarnings" class="hover-box container">
                <hr>
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

            <STList>
                <CartItemRow v-for="cartItem of order.data.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="order.data.cart" :webshop="webshop" :editable="false" :admin="true" />
            </STList>

            <hr>
            <h2>Informatie</h2>

            <STList>
                <STListItem v-if="order.totalToPay || !webshop?.isAllFree">
                    <h3 class="style-definition-label">
                        Totaal te betalen
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.totalToPay) }}
                    </p>
                </STListItem>

                <STListItem v-if="(order.totalToPay || !webshop?.isAllFree) && (order.pricePaid > 0 && order.pricePaid !== order.totalToPay)">
                    <h3 class="style-definition-label">
                        Betaald bedrag
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(order.pricePaid) }}
                    </p>
                </STListItem>

                <STListItem v-if="order.validAt !== null">
                    <h3 class="style-definition-label">
                        Geplaatst op
                    </h3>
                    <p class="style-definition-text">
                        {{ capitalizeFirstLetter(formatDateTime(order.validAt)) }}
                    </p>
                </STListItem>

                <STListItem v-long-press="(e: Event) => (hasWrite ? markAs(e) : null)" class="right-description right-stack" :selectable="hasWrite" @click="hasWrite ? markAs($event) : null">
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
            </STList>

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
                    <STListItem v-if="(order.data.checkoutMethod as any).address" class="right-description">
                        <h3 class="style-definition-label">
                            Adres
                        </h3>

                        <p class="style-definition-text">
                            {{ (order.data.checkoutMethod as any).address }}
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
                    <STListItem v-if="order.data.administrationFee > 0" class="right-description">
                        <h3 class="style-definition-label">
                            Administratiekosten
                        </h3>

                        <p class="style-definition-text">
                            {{ formatPrice(order.data.administrationFee) }}
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
            </STList>

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="order.data" />

            <div v-if="order.data.comments" class="container">
                <hr>
                <h2>
                    Notities
                </h2>

                <p class="pre-wrap" v-text="order.data.comments" />
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
                Deze bestelling werd geannuleerd
            </p>

            <p v-if="order.payment && order.payment.status !== 'Succeeded'" class="warning-box">
                Opgelet: deze bestelling werd nog niet betaald.
            </p>

            <p v-if="changedSeatString" class="warning-box">
                {{ changedSeatString }}
            </p>

            <div v-if="hasWarnings" class="hover-box container">
                <hr>
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
                <STListItem v-if="item.product.dateRange">
                    <h3 class="style-definition-label">
                        Wanneer?
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
                        Bestelling
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
                Leeg ticket?
            </h1>
            <p>Er ging iets mis bij het lezen van de inhoud van dit ticket.</p>
        </main>

        <STToolbar>
            <template #right>
                <button v-if="ticket.scannedAt" class="button secundary" type="button" @click="cancelScan">
                    Markering ongedaan maken
                </button>
                <button class="button primary" type="button" @click="markScanned">
                    <span class="icon qr-code" />
                    <span>Markeer als gescand</span>
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
