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
                    <a :href="'https://'+$domains.marketing+'?utm_medium=webshop'" target="_blank" class="button text"><span v-if="hasTickets">{{ $t('e5749f83-1a33-4185-a07a-b2beea3b69ca') }} </span><span v-else>{{ $t('b76dc7cb-2b83-4f21-a601-e8f301052a67') }}</span>  <Logo /></a>
                </p>
                <div class="box">
                    <main>
                        <h1 v-if="success">
                            {{ $t('575c2a59-2f76-467b-a03d-4b243464a85f') }}
                        </h1>
                        <h1 v-else>
                            {{ $t('f8d1f500-51d4-4ade-8291-51606cfb10c0') }}
                        </h1>

                        <p v-if="success">
                            {{ $t('08a0920c-e5c1-443c-80e6-5e8441248903') }}
                        </p>

                        <p v-if="isFailed && !closed" class="error-box selectable with-button" @click="() => pop()">
                            {{ $t('f20a769b-717c-411f-9b15-f0f1c767b51e') }}

                            <button class="button text" type="button">
                                {{ $t('7889a8f8-a31e-4291-b8e7-6169e68ed6b4') }}
                            </button>
                        </p>
                        <p v-else-if="isFailed" class="error-box selectable with-button" @click="() => pop()">
                            {{ $t('3554f028-5050-44fd-80eb-da5608021a86') }}

                            <button class="button text" type="button">
                                {{ $t('1b311bbf-8cc3-4b91-a019-f80a062d8d4d') }}
                            </button>
                        </p>
                        <p v-else-if="isDeleted" class="error-box">
                            {{ $t('7f88d4cc-ddbb-45fc-aa7e-1c6b31e26f7c') }}
                        </p>
                        <p v-else-if="isCanceled" class="error-box">
                            {{ $t('9a6904ac-2c29-443a-9e73-7c7588c626be') }}
                        </p>

                        <section v-if="!isCanceled && hasTickets && (isPaid || !isTransfer)" id="tickets" class="container">
                            <hr><h2 class="style-with-button">
                                <div v-if="singleTicket">
                                    {{ $t('0c690de0-77ee-4115-bd52-c4eb70b6387c') }}
                                </div>
                                <div v-else>
                                    {{ $t('610ae813-c8e8-44f2-a0fa-dc83d38f1cee') }}
                                </div>
                                <div class="hover-show">
                                    <button v-if="!loadingTickets" class="button text limit-space" type="button" @click="downloadAllTickets">
                                        <span class="icon download" />
                                        <span>{{ $t('a103aa7c-4693-4bd2-b903-d14b70bfd602') }}</span>
                                    </button>
                                </div>
                            </h2>
                            <p v-if="!singleTicket" class="hide-smartphone style-description">
                                {{ $t('5933154a-b9da-45e5-bd25-d5a9304d9007') }}
                            </p>
                            <p v-if="!singleTicket" class="only-smartphone style-description">
                                {{ $t('3674c705-d837-4c2c-b29e-5eca62703e00') }}
                            </p>

                            <p v-if="singleTicket" class="style-description">
                                {{ $t('d00c85cf-5f7c-4cec-9ad7-0fe74ad116ee') }}
                            </p>

                            <Spinner v-if="loadingTickets" />
                            <template v-else>
                                <button v-if="publicTickets.length === 1" class="button primary" type="button" @click="openTicket(publicTickets[0])">
                                    <span class="icon qr-code" />
                                    <span>{{ $t('4d1056b0-250a-435b-b78f-a1e9f03e190e') }}</span>
                                </button>

                                <STList v-else>
                                    <TicketListItem v-for="ticket in publicTickets" :key="ticket.id" :ticket="ticket" :webshop="webshop" :organization="organization" :order="order" />
                                </STList>
                            </template>

                            <hr><h2>{{ $t('4385bcc8-1643-4352-b766-a658e4c33f80') }}</h2>
                        </section>

                        <template v-else-if="hasTickets">
                            <hr><h2 v-if="singleTicket">
                                {{ $t('0c690de0-77ee-4115-bd52-c4eb70b6387c') }}
                            </h2>
                            <h2 v-else>
                                {{ $t('610ae813-c8e8-44f2-a0fa-dc83d38f1cee') }}
                            </h2>

                            <p v-if="!isPaid && isTransfer" class="warning-box">
                                {{ $t('87c0a82e-68ff-4e53-8124-08bc2d532d47') }} <template v-if="singleTicket">
                                    {{ $t('c6968b48-2dcc-47ea-b1b2-647ad01e62e6') }}
                                </template><template v-else>
                                    {{ $t('b96dd30e-df8d-4cef-8a8c-f73eb842f6d3') }}
                                </template> {{ $t('8bd25077-dabe-4ccc-ae37-8aa0236636e4') }}
                            </p>
                            <p v-else>
                                {{ $t('005e0815-0491-4097-8a08-3da585dcd24e') }} <template v-if="singleTicket">
                                    {{ $t('c6968b48-2dcc-47ea-b1b2-647ad01e62e6') }}
                                </template><template v-else>
                                    {{ $t('b96dd30e-df8d-4cef-8a8c-f73eb842f6d3') }}
                                </template> {{ $t('b1bb4138-62b1-4b25-a495-1a892bcfa8d6') }}
                            </p>

                            <a v-if="isPaid" href="#tickets" class="button primary">
                                <span class="icon arrow-down" />
                                <span v-if="singleTicket">{{ $t('2a4bf4a3-151a-494a-85d8-2d8006fcaef9') }}</span>
                                <span v-else>{{ $t('232adc12-6c82-4a13-a085-ce1b702acfa6') }}</span>
                            </a>

                            <hr><h2>{{ $t('4385bcc8-1643-4352-b766-a658e4c33f80') }}</h2>
                        </template>
                        <p v-else-if="!isCanceled && !isPaid && isTransfer" class="warning-box">
                            {{ $t('49097ad0-f257-4132-9b47-d61866e70cd1') }}
                        </p>
                        <p v-else-if="!isCanceled && !isPaid && !isTransfer" class="warning-box">
                            {{ $t('4a2f9baa-da83-4cf9-a39c-59e7f37c1823') }} {{ getLowerCaseName(order.data.paymentMethod) }}
                        </p>

                        <STList class="info">
                            <STListItem>
                                <h3 class="style-definition-label">
                                    {{ $t('d41226a0-e877-4874-8333-25c0dcf96001') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ webshop.meta.name }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.number && !isDeleted" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('4d496edf-0203-4df3-a6e9-3e58d226d6c5') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ order.number }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.data.customer.name" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('17edcdd6-4fb2-4882-adec-d3a4f43a1926') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ order.data.customer.name }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.data.customer.email" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('7400cdce-dfb4-40e7-996b-4817385be8d8') }}
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
                                    {{ $t('d1d52570-86b9-4edd-82c4-ccc1d759c6dc') }}
                                </h3>
                                <p class="style-definition-text">
                                    {{ capitalizeFirstLetter(formatDateTime(order.validAt)) }}
                                </p>
                            </STListItem>

                            <STListItem class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5') }}
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
                            </template>
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
                            <STListItem v-if="order.data.totalPrice || !webshop.isAllFree" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('e67d0122-6f15-46c6-af94-92a79268710a') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ formatPrice(order.data.totalPrice) }}
                                </p>
                            </STListItem>
                        </STList>

                        <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="order.data" />

                        <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                            <hr><h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                                {{ $t('038031a7-0942-493a-9eb5-0cea9bb487b0') }}
                            </h2>
                            <h2 v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                                {{ $t('12b2ce84-6297-49a2-a9c4-d5619b764313') }}
                            </h2>
                            <h2 v-else>
                                {{ $t('22af7a31-3e7c-43ee-aa6f-d6638719caed') }}
                            </h2>

                            <p class="pre-wrap" v-text="order.data.checkoutMethod.description" />
                        </div>

                        <template v-if="!hasTickets || hasSingleTicket || !isPaid">
                            <hr><p v-for="code of order.data.discountCodes" :key="code.id" class="discount-box icon label">
                                <span>{{ $t('46a3962f-7d21-4cf4-b3a9-bfec8007e68a') }} <span class="style-discount-code">{{ code.code }}</span></span>
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
                                <span>{{ $t('bf43c364-65c2-4cbe-98ff-f9e6b4c7d659') }}</span>
                            </button>
                            <button v-if="!isPaid && isTransfer" class="button primary" type="button" @click="openTransferView(getDefaultTransferPayment())">
                                <span class="icon card" />
                                <span>{{ $t('ee3f6752-b47c-46c4-9746-f9832f5df4ea') }}</span>
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
