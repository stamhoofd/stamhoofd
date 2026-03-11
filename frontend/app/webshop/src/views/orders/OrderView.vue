<template>
    <LoadingViewTransition>
        <div v-if="order" class="st-view order-view box-shade">
            <STNavigationBar :large="true" :sticky="false" :left-logo="true">
                <template #left>
                    <OrganizationLogo :organization="organization" :webshop="webshop" />
                </template>
            </STNavigationBar>

            <main>
                <p v-if="!webshop.meta.reduceBranding && STAMHOOFD.platformName === 'stamhoofd'" class="stamhoofd-header">
                    <a :href="'https://'+$domains.marketing+'?utm_medium=webshop'" target="_blank" class="button text"><span v-if="hasTickets">{{ $t('%Y3') }} </span><span v-else>{{ $t('%Y4') }}</span>  <Logo /></a>
                </p>
                <div class="box">
                    <main>
                        <h1 v-if="success">
                            {{ $t('%Y5') }}
                        </h1>
                        <h1 v-else>
                            {{ $t('%Y6') }}
                        </h1>

                        <p v-if="success">
                            {{ $t('%Y7') }}
                        </p>

                        <p v-if="isFailed && !closed" class="error-box selectable with-button" @click="() => pop()">
                            {{ $t('%Y8') }}

                            <button class="button text" type="button">
                                {{ $t('%Y9') }}
                            </button>
                        </p>
                        <p v-else-if="isFailed" class="error-box selectable with-button" @click="() => pop()">
                            {{ $t('%YA') }}

                            <button class="button text" type="button">
                                {{ $t('%Vz') }}
                            </button>
                        </p>
                        <p v-else-if="isDeleted" class="error-box">
                            {{ $t('%YB') }}
                        </p>
                        <p v-else-if="isCanceled" class="error-box">
                            {{ $t('%W3') }}
                        </p>

                        <section v-if="!isCanceled && hasTickets && (isPaid || !isTransfer)" id="tickets" class="container">
                            <hr><h2 class="style-with-button">
                                <div v-if="singleTicket">
                                    {{ $t('%YC') }}
                                </div>
                                <div v-else>
                                    {{ $t('%YD') }}
                                </div>
                                <div class="hover-show">
                                    <button v-if="!loadingTickets" class="button text limit-space" type="button" @click="downloadAllTickets">
                                        <span class="icon download" />
                                        <span>{{ $t('%v7') }}</span>
                                    </button>
                                </div>
                            </h2>
                            <p v-if="!singleTicket" class="hide-smartphone style-description">
                                {{ $t('%YE') }}
                            </p>
                            <p v-if="!singleTicket" class="only-smartphone style-description">
                                {{ $t('%YF') }}
                            </p>

                            <p v-if="singleTicket" class="style-description">
                                {{ $t('%YG') }}
                            </p>

                            <Spinner v-if="loadingTickets" />
                            <template v-else>
                                <button v-if="publicTickets.length === 1" class="button primary" type="button" @click="openTicket(publicTickets[0])">
                                    <span class="icon qr-code" />
                                    <span>{{ $t('%YH') }}</span>
                                </button>

                                <STList v-else>
                                    <TicketListItem v-for="ticket in publicTickets" :key="ticket.id" :ticket="ticket" :webshop="webshop" :organization="organization" :order="order" />
                                </STList>
                            </template>

                            <hr><h2>{{ $t('%YI') }}</h2>
                        </section>

                        <template v-else-if="hasTickets">
                            <hr><h2 v-if="singleTicket">
                                {{ $t('%YC') }}
                            </h2>
                            <h2 v-else>
                                {{ $t('%YD') }}
                            </h2>

                            <p v-if="!isPaid && isTransfer" class="warning-box">
                                {{ $t('%YJ') }} <template v-if="singleTicket">
                                    {{ $t('%YK') }}
                                </template><template v-else>
                                    {{ $t('%YL') }}
                                </template> {{ $t('%YM') }}
                            </p>
                            <p v-else>
                                {{ $t('%YN') }} <template v-if="singleTicket">
                                    {{ $t('%YK') }}
                                </template><template v-else>
                                    {{ $t('%YL') }}
                                </template> {{ $t('%YO') }}
                            </p>

                            <a v-if="isPaid" href="#tickets" class="button primary">
                                <span class="icon arrow-down" />
                                <span v-if="singleTicket">{{ $t('%YP') }}</span>
                                <span v-else>{{ $t('%YQ') }}</span>
                            </a>

                            <hr><h2>{{ $t('%YI') }}</h2>
                        </template>
                        <p v-else-if="!isCanceled && !isPaid && isTransfer" class="warning-box">
                            {{ $t('%YR') }}
                        </p>
                        <p v-else-if="!isCanceled && !isPaid && !isTransfer" class="warning-box">
                            {{ $t('%YS') }} {{ getLowerCaseName(order.data.paymentMethod) }}
                        </p>

                        <STList class="info">
                            <STListItem>
                                <h3 class="style-definition-label">
                                    {{ $t('%1AV') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ webshop.meta.name }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.number && !isDeleted" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('%xA') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ order.number }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.data.customer.name" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('%Gq') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ order.data.customer.name }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.data.customer.email" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('%1FK') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ order.data.customer.email }}
                                </p>
                            </STListItem>
                            <STListItem v-for="(payment, index) in order.payments" :key="payment.id" class="right-description right-stack" :selectable="isPaymentTransfer(payment)" @click="openTransferView(payment)">
                                <h3 class="style-definition-label">
                                    {{ payment.price >= 0 ? 'Betaling' : 'Terugbetaling' }} {{ order.payments.length > 1 ? index + 1 : '' }}
                                </h3>

                                <p class="style-definition-text">
                                    <span>{{ getName(payment.method) }}</span>

                                    <span v-if="payment.status === 'Succeeded'" class="icon green success" />
                                    <span v-else-if="isPaymentTransfer(payment)" class="icon help" />
                                    <span v-else class="icon clock" />
                                </p>

                                <template #right>
                                    <span v-if="order.payments.length > 1">{{ formatPrice(payment.price) }}</span>
                                </template>
                            </STListItem>
                            <STListItem v-for="a in order.data.fieldAnswers" :key="a.field.id" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ a.field.name }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ a.answer || "/" }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.validAt" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('%VR') }}
                                </h3>
                                <p class="style-definition-text">
                                    {{ capitalizeFirstLetter(formatDateTime(order.validAt)) }}
                                </p>
                            </STListItem>

                            <STListItem class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('%1A') }}
                                </h3>

                                <p class="style-definition-text">
                                    <span>{{ statusName }}</span>
                                    <span v-if="isCanceled" class="icon canceled" />
                                </p>
                            </STListItem>

                            <template v-if="order.data.checkoutMethod">
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
                            </template>
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
                            <STListItem v-if="order.data.totalPrice || !webshop.isAllFree" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('%xL') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ formatPrice(order.data.totalPrice) }}
                                </p>
                            </STListItem>
                        </STList>

                        <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="order.data" />

                        <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                            <hr><h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                                {{ $t('%Vf') }}
                            </h2>
                            <h2 v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                                {{ $t('%YT') }}
                            </h2>
                            <h2 v-else>
                                {{ $t('%Vg') }}
                            </h2>

                            <p class="pre-wrap" v-text="order.data.checkoutMethod.description" />
                        </div>

                        <template v-if="!hasTickets || hasSingleTicket || !isPaid">
                            <hr><p v-for="code of order.data.discountCodes" :key="code.id" class="discount-box icon label">
                                <span>{{ $t('%1MX') }} <span class="style-discount-code">{{ code.code }}</span></span>
                            </p>

                            <STList>
                                <CartItemRow v-for="cartItem of order.data.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="order.data.cart" :webshop="webshop" :editable="false" :admin="false" />
                            </STList>

                            <hr><PriceBreakdownBox :price-breakdown="order.data.priceBreakown" />
                        </template>
                    </main>
                    <STToolbar v-if="!isCanceled && ((canShare && !hasTickets) || (!isPaid && isTransfer))" :sticky="false">
                        <template #right>
                            <button v-if="canShare && !hasTickets" class="button secundary" type="button" @click="share">
                                <span class="icon share" />
                                <span>{{ $t('%YU') }}</span>
                            </button>
                            <button v-if="!isPaid && isTransfer" class="button primary" type="button" @click="openTransferView(getDefaultTransferPayment())">
                                <span class="icon card" />
                                <span>{{ $t('%YV') }}</span>
                            </button>
                        </template>
                    </STToolbar>
                </div>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, setUrl, usePop, usePresent, useUrl } from '@simonbackx/vue-app-navigation';
import { CartItemRow, CenteredMessage, DetailedTicketView, LoadingViewTransition, Logo, OrganizationLogo, PriceBreakdownBox, STList, STListItem, STNavigationBar, STToolbar, Spinner, Toast, TransferPaymentView, ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { Order, OrderStatus, OrderStatusHelper, Payment, PaymentMethod, PaymentMethodHelper, PaymentStatus, ProductType, RecordCategory, TicketOrder, TicketPublic, WebshopTicketType } from '@stamhoofd/structures';
import { Ref, computed, onMounted, ref, watch } from 'vue';

import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import TicketListItem from '../products/TicketListItem.vue';

const props = withDefaults(defineProps<{
    orderId?: string | null;
    paymentId?: string | null;
    initialOrder?: Order | null;
    success?: boolean;
}>(), {
    orderId: null,
    paymentId: null,
    initialOrder: null,
    success: false,
});

const webshopManager = useWebshopManager();
const checkoutManager = useCheckoutManager();
const present = usePresent();
const pop = usePop();

const order = ref<Order | null>(props.initialOrder) as Ref<Order | null>;
const tickets = ref<TicketPublic[]>([]) as Ref<TicketPublic[]>;
const loadingTickets = ref(false);
const organization = computed(() => webshopManager.organization);
const webshop = computed(() => webshopManager.webshop);
const singleTicket = computed(() => tickets.value.length === 1 || webshop.value.meta.ticketType === WebshopTicketType.SingleTicket);
const canShare = computed(() => !!navigator.share);
const isPaid = computed(() => order.value && (order.value.payment === null || order.value.payment.status === PaymentStatus.Succeeded));
const isTransfer = computed(() => getDefaultTransferPayment() !== null);

// Make sure the url is overriden
setUrl('order/' + (order.value?.id ?? props.orderId), 'Bestelling ' + (order.value?.number ?? ''));

const urlHelpers = useUrl();

watch(() => order.value, () => {
    // Change if we loaded the order id or number
    urlHelpers.overrideUrl('order/' + (order.value?.id ?? props.orderId), 'Bestelling ' + (order.value?.number ?? ''));
});

function isPaymentTransfer(payment: Payment) {
    return payment.method === PaymentMethod.Transfer;
}

const closed = computed(() => webshop.value.isClosed(2 * 60 * 1000) || !organization.value.meta.packages.useWebshops);
const isFailed = computed(() => !order.value || order.value.number === null);
const isCanceled = computed(() => !order.value || order.value.status === OrderStatus.Canceled || order.value.status === OrderStatus.Deleted);
const isDeleted = computed(() => !order.value || order.value.status === OrderStatus.Deleted);
const hasTickets = computed(() => {
    return (order.value && order.value.status !== OrderStatus.Canceled && order.value.status !== OrderStatus.Deleted) && (webshop.value.meta.ticketType === WebshopTicketType.SingleTicket || !!order.value?.data.cart.items.find(i => i.product.type === ProductType.Voucher || i.product.type === ProductType.Ticket));
});

const hasSingleTicket = computed(() => webshop.value.meta.ticketType === WebshopTicketType.SingleTicket);
const statusName = computed(() => {
    if (isFailed.value) {
        return 'Mislukt';
    }
    return order.value ? OrderStatusHelper.getName(order.value.status) : '';
});

const publicTickets = computed(() => tickets.value);
const recordCategories = computed(() => {
    if (!order.value) {
        return [];
    }
    return RecordCategory.flattenCategories(
        webshop.value.meta.recordCategories,
        order.value.data,
    );
});

function share() {
    navigator.share({
        title: 'Bestelling ' + webshopManager.webshop.meta.name,
        text: 'Bekijk mijn bestelling bij ' + webshopManager.webshop.meta.name + ' via deze link.',
        url: 'https://' + webshopManager.webshop.getUrl(organization.value) + '/order/' + order.value!.id,
    }).catch(e => console.error(e));
}

function getName(paymentMethod: PaymentMethod): string {
    return PaymentMethodHelper.getNameCapitalized(paymentMethod, order.value?.data.paymentContext);
}

function getLowerCaseName(paymentMethod: PaymentMethod): string {
    return PaymentMethodHelper.getName(paymentMethod, order.value?.data.paymentContext);
}

function openTransferView(payment: Payment) {
    if (payment.method === PaymentMethod.Transfer) {
        present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(TransferPaymentView, {
                type: 'order',
                payment,
                organization: webshopManager.organization,
                settings: webshopManager.webshop.meta.transferSettings,
                isPopup: true,
            }),
        }).setDisplayStyle('popup')).catch(console.error);
    }
}

function getDefaultTransferPayment() {
    const payments = order.value?.payments.filter(p => p.method === PaymentMethod.Transfer && p.price >= 0) ?? [];
    return payments[0] ?? null;
}

async function checkTickets() {
    if (!hasTickets.value || !order.value || (!isPaid.value && isTransfer.value)) {
        return;
    }
    loadingTickets.value = true;

    try {
        const response = await webshopManager.server.request({
            method: 'GET',
            path: '/webshop/' + webshopManager.webshop.id + '/tickets',
            query: {
                // Required because we don't need to repeat item information (network + database impact)
                orderId: order.value.id,
            },
            decoder: new ArrayDecoder(TicketOrder as Decoder<TicketOrder>),
        });
        tickets.value = response.data.map(ticket => ticket.getPublic(order.value!)).sort(TicketPublic.sort);
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    loadingTickets.value = false;
}

onMounted(() => {
    if (props.success) {
        checkoutManager.clear();

        // Update stock in background
        webshopManager.reload().catch((e) => {
            console.error(e);
        });
    }
    if (order.value) {
        checkTickets().catch(console.error);
        return;
    }
    // Load order
    if (props.orderId) {
        webshopManager.server
            .request({
                method: 'GET',
                path: '/webshop/' + webshopManager.webshop.id + '/order/' + props.orderId,
                decoder: Order as Decoder<Order>,
            }).then((response) => {
                const orderValue = response.data;
                order.value = orderValue;
                checkTickets().catch(console.error);
            }).catch((e) => {
                // too: handle this
                console.error(e);
                new CenteredMessage('Ongeldige bestelling', 'De bestelling die je opvraagt bestaat niet (meer)', 'error').addCloseButton().show();
                pop({ force: true })?.catch(console.error);
            });
    }
    else {
        if (!props.paymentId) {
            throw new Error('Missing payment id or order id');
        }
        webshopManager.server
            .request({
                method: 'GET',
                path: '/webshop/' + webshopManager.webshop.id + '/payment/' + props.paymentId + '/order',
                decoder: Order as Decoder<Order>,
            }).then((response) => {
                const orderValue = response.data;
                order.value = orderValue;
                checkTickets().catch(console.error);
            }).catch((e) => {
                // too: handle this
                console.error(e);
                new CenteredMessage('Ongeldige bestelling', 'De bestelling die je opvraagt bestaat niet (meer)', 'error').addCloseButton().show();
                pop({ force: true })?.catch(console.error);
            });
    }
});

async function downloadAllTickets() {
    const TicketBuilder = (await import(
        /* webpackChunkName: "TicketBuilder" */
        /* webpackPrefetch: true */
        '@stamhoofd/ticket-builder',
    )).TicketBuilder;

    const builder = new TicketBuilder(publicTickets.value, webshop.value, webshopManager.organization, order.value ?? undefined);
    await builder.download();
}

function openTicket(ticket: TicketPublic) {
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(DetailedTicketView, {
                    ticket: ticket,
                    order: order.value,
                    webshop: webshop.value,
                    organization: organization.value,
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.order-view {
    .stamhoofd-header {
        --color-primary: #{$color-primary-original};
        @extend .style-description-small;
        max-width: var(--box-width, 800px);
        margin: 0 auto;
        padding-bottom: 20px;

        @media (max-width: 800px) {
            padding: 15px;
            background: $color-background-shade;
            border-radius: 10px;
            margin-bottom: 30px;
        }

        a {
            white-space: normal;
            text-overflow: initial;
            height: auto;
            line-height: 1.4;
            display: flex;
            flex-direction: row;
            align-items: center;
            min-width: 0;
            max-width: none;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 10px;

            @media (max-width: 800px) {
                justify-content: center;
                text-align: center;
            }

            &,
                &:hover,
                &:link,
                &:active,
                &:visited {
                    color: $color-gray-text;
                    font-weight: 600;
                    text-decoration: none;
                }
        }

        .stamhoofd-logo-container {
            display: block;

            svg {
                width: 140px;
            }
        }

         @media (max-width: 500px) {
             .stamhoofd-logo-container {
                 svg {
                     width: 120px;
                 }
             }
         }
    }

    .pre-wrap {
        @extend .style-description;
        white-space: pre-wrap;
    }
}
</style>
