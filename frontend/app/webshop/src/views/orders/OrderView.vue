<template>
    <LoadingViewTransition>
        <div v-if="order" class="st-view order-view box-shade">
            <STNavigationBar :large="true" :sticky="false" :left-logo="true">
                <template #left>
                    <OrganizationLogo :organization="organization" :webshop="webshop"/>
                </template>
            </STNavigationBar>

            <main>
                <p v-if="!webshop.meta.reduceBranding && STAMHOOFD.platformName === 'stamhoofd'" class="stamhoofd-header">
                    <a :href="'https://'+$domains.marketing+'?utm_medium=webshop'" target="_blank" class="button text"><span v-if="hasTickets">{{ $t('3896d38a-8485-4ec5-b468-a1c5187094b8') }} </span><span v-else>{{ $t('8a739850-926b-4df2-9f14-8b254cb8e256') }}</span>  <Logo/></a>
                </p>
                <div class="box">
                    <main>
                        <h1 v-if="success">
                            {{ $t('d2771b73-cfdf-47a9-bd32-d9408649bc8f') }}
                        </h1>
                        <h1 v-else>
                            {{ $t('e232bc84-cadf-4f4e-8239-1a15b3eb6349') }}
                        </h1>

                        <p v-if="success">
                            {{ $t('fbd8c316-e837-4a39-8617-40d31d98f3b7') }}
                        </p>

                        <p v-if="isFailed && !closed" class="error-box selectable with-button" @click="() => pop()">
                            {{ $t('837f6426-dbe4-4fe6-bfb5-ce1e7a280fa4') }}

                            <button class="button text" type="button">
                                {{ $t('9f51c413-5080-409c-91ac-d39a16501663') }}
                            </button>
                        </p>
                        <p v-else-if="isFailed" class="error-box selectable with-button" @click="() => pop()">
                            {{ $t('99883ddf-ff49-4c1d-a32a-bc4fb2f6b526') }}

                            <button class="button text" type="button">
                                {{ $t('7997eb1c-d686-4a83-9885-ed46d0da34c5') }}
                            </button>
                        </p>
                        <p v-else-if="isDeleted" class="error-box">
                            {{ $t('6b3ebcdd-f5e4-456e-9c1a-0624701844a1') }}
                        </p>
                        <p v-else-if="isCanceled" class="error-box">
                            {{ $t('3d4e2887-7206-44a3-ba1b-cfca36cfcec2') }}
                        </p>

                        <section v-if="!isCanceled && hasTickets && (isPaid || !isTransfer)" id="tickets" class="container">
                            <hr><h2 class="style-with-button">
                                <div v-if="singleTicket">
                                    {{ $t('dd4d70f8-8ad0-44f7-bd38-4ee175d91aab') }}
                                </div>
                                <div v-else>
                                    {{ $t('af7aab1a-5f21-48bf-ba3e-6ffdc2fe9eca') }}
                                </div>
                                <div class="hover-show">
                                    <button v-if="!loadingTickets" class="button text limit-space" type="button" @click="downloadAllTickets">
                                        <span class="icon download"/>
                                        <span>{{ $t('bd7fc57f-7ba8-4011-8557-a720a55ecc6f') }}</span>
                                    </button>
                                </div>
                            </h2>
                            <p v-if="!singleTicket" class="hide-smartphone style-description">
                                {{ $t('c186d36f-4087-4d79-a4d4-71585d9855d0') }}
                            </p>
                            <p v-if="!singleTicket" class="only-smartphone style-description">
                                {{ $t('6422e734-49a8-45a3-9062-282733456dd4') }}
                            </p>

                            <p v-if="singleTicket" class="style-description">
                                {{ $t('17388459-7421-472e-a3b9-18c9fdfcb096') }}
                            </p>

                            <Spinner v-if="loadingTickets"/>
                            <template v-else>
                                <button v-if="publicTickets.length === 1" class="button primary" type="button" @click="openTicket(publicTickets[0])">
                                    <span class="icon qr-code"/>
                                    <span>{{ $t('b65e6c8e-b49b-4979-affa-5fbaae3191f4') }}</span>
                                </button>

                                <STList v-else>
                                    <TicketListItem v-for="ticket in publicTickets" :key="ticket.id" :ticket="ticket" :webshop="webshop" :organization="organization" :order="order"/>
                                </STList>
                            </template>

                            <hr><h2>{{ $t('822d36fc-b3d0-4477-8c05-3699e43324ac') }}</h2>
                        </section>

                        <template v-else-if="hasTickets">
                            <hr><h2 v-if="singleTicket">
                                {{ $t('dd4d70f8-8ad0-44f7-bd38-4ee175d91aab') }}
                            </h2>
                            <h2 v-else>
                                {{ $t('af7aab1a-5f21-48bf-ba3e-6ffdc2fe9eca') }}
                            </h2>

                            <p v-if="!isPaid && isTransfer" class="warning-box">
                                {{ $t('101beef3-0d75-452c-8a12-08f71cb7e3ec') }} <template v-if="singleTicket">
                                    {{ $t('0f2c9269-7d6d-4f78-a9be-7a495018d941') }}
                                </template><template v-else>
                                    {{ $t('6ba58faf-147c-470a-a07c-d44b8465f3ff') }}
                                </template> {{ $t('df5c74fa-627c-47c1-9c98-dd058bdb3ae3') }}
                            </p>
                            <p v-else>
                                {{ $t('09c479ff-77ec-4e5f-a46c-96452029747c') }} <template v-if="singleTicket">
                                    {{ $t('0f2c9269-7d6d-4f78-a9be-7a495018d941') }}
                                </template><template v-else>
                                    {{ $t('6ba58faf-147c-470a-a07c-d44b8465f3ff') }}
                                </template> {{ $t('1a88f49f-b637-452d-8bb0-bb30926ed857') }}
                            </p>

                            <a v-if="isPaid" href="#tickets" class="button primary">
                                <span class="icon arrow-down"/>
                                <span v-if="singleTicket">{{ $t('f5f8b7a0-498e-49e0-849e-e8da88e7caa2') }}</span>
                                <span v-else>{{ $t('a417cc31-6cd2-4ec6-8d1a-918adf70243b') }}</span>
                            </a>

                            <hr><h2>{{ $t('822d36fc-b3d0-4477-8c05-3699e43324ac') }}</h2>
                        </template>
                        <p v-else-if="!isCanceled && !isPaid && isTransfer" class="warning-box">
                            {{ $t('eb6f034b-78f4-4d0d-bcc9-e0b1e8dcdca5') }}
                        </p>
                        <p v-else-if="!isCanceled && !isPaid && !isTransfer" class="warning-box">
                            {{ $t('bb11914c-e76d-40f0-aca5-ed650a0bc480') }} {{ getLowerCaseName(order.data.paymentMethod) }}
                        </p>

                        <STList class="info">
                            <STListItem v-if="order.number && !isDeleted" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('7a8da927-9962-44d0-9407-6e0f1f80b0d5') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ order.number }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.data.customer.name" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('d32893b7-c9b0-4ea3-a311-90d29f2c0cf3') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ order.data.customer.name }}
                                </p>
                            </STListItem>
                            <STListItem v-if="order.data.customer.email" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('0be79160-b242-44dd-94f0-760093f7f9f2') }}
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

                                    <span v-if="payment.status === 'Succeeded'" class="icon green success"/>
                                    <span v-else-if="isPaymentTransfer(payment)" class="icon help"/>
                                    <span v-else class="icon clock"/>
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
                                    {{ $t('4a9ae395-aad5-4d47-abaf-3e1b90438f5e') }}
                                </h3>
                                <p class="style-definition-text">
                                    {{ capitalizeFirstLetter(formatDateTime(order.validAt)) }}
                                </p>
                            </STListItem>

                            <STListItem class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('38b75e19-10cb-4641-88a8-f4e2e9be7576') }}
                                </h3>

                                <p class="style-definition-text">
                                    <span>{{ statusName }}</span>
                                    <span v-if="isCanceled" class="icon canceled"/>
                                </p>
                            </STListItem>

                            <template v-if="order.data.checkoutMethod">
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
                            </template>
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
                            <STListItem v-if="order.data.totalPrice || !webshop.isAllFree" class="right-description">
                                <h3 class="style-definition-label">
                                    {{ $t('b0176412-775d-40b3-9eb7-4b80e5593b3e') }}
                                </h3>

                                <p class="style-definition-text">
                                    {{ formatPrice(order.data.totalPrice) }}
                                </p>
                            </STListItem>
                        </STList>

                        <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="order.data"/>

                        <div v-if="order.data.checkoutMethod && order.data.checkoutMethod.description" class="container">
                            <hr><h2 v-if="order.data.checkoutMethod.type === 'Takeout'">
                                {{ $t('8252906e-b116-4920-b62a-a83e9f05aca0') }}
                            </h2>
                            <h2 v-else-if="order.data.checkoutMethod.type === 'OnSite'">
                                {{ $t('2f5e4541-c3ec-45db-873e-a8c202e87bc5') }}
                            </h2>
                            <h2 v-else>
                                {{ $t('4b594046-78a6-4928-a5cd-1fb7db4a6beb') }}
                            </h2>

                            <p class="pre-wrap" v-text="order.data.checkoutMethod.description"/>
                        </div>

                        <template v-if="!hasTickets || hasSingleTicket || !isPaid">
                            <hr><p v-for="code of order.data.discountCodes" :key="code.id" class="discount-box icon label">
                                <span>{{ $t('2f4e2886-2c75-47d7-8bc4-5ace1a8d3a33') }} <span class="style-discount-code">{{ code.code }}</span></span>
                            </p>

                            <STList>
                                <CartItemRow v-for="cartItem of order.data.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="order.data.cart" :webshop="webshop" :editable="false" :admin="false"/>
                            </STList>

                            <hr><PriceBreakdownBox :price-breakdown="order.data.priceBreakown"/>
                        </template>
                    </main>
                    <STToolbar v-if="!isCanceled && ((canShare && !hasTickets) || (!isPaid && isTransfer))" :sticky="false">
                        <template #right>
                            <button v-if="canShare && !hasTickets" class="button secundary" type="button" @click="share">
                                <span class="icon share"/>
                                <span>{{ $t('9b0b9956-0ba5-48ec-8929-dd34aadb8227') }}</span>
                            </button>
                            <button v-if="!isPaid && isTransfer" class="button primary" type="button" @click="openTransferView(getDefaultTransferPayment())">
                                <span class="icon card"/>
                                <span>{{ $t('0b047229-83c8-4df8-9e16-6f736b9385ed') }}</span>
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
        url: webshopManager.webshop.getUrl(organization.value) + '/order/' + order.value!.id,
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
        '@stamhoofd/ticket-builder'
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
