<template>
    <div class="st-view payment-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="$t('%hA')" type="button" class="button icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="$t('%hB')" type="button" class="button icon arrow-down" :disabled="!hasNext" @click="goForward" />
                <button v-if="canWrite" v-tooltip="$t('%1Ki')" type="button" class="button icon edit" @click="editPayment" />
                <button v-if="auth.hasFullAccess() && payment.organizationId === organization?.id" v-tooltip="$t('%1KS')" type="button" class="button icon history" @click="viewAudit" />
            </template>
        </STNavigationBar>

        <main>
            <p v-if="payment.type !== PaymentType.Payment && payment.method !== PaymentMethod.Unknown" :class="'style-title-prefix ' + payment.theme">
                <span>{{ PaymentTypeHelper.getName(payment.type) }}</span>
                <span :class="'icon small ' + PaymentTypeHelper.getIcon(payment.type)" />
            </p>

            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ title }}</span>

                <span v-if="payment.isPending" v-tooltip="$t('%1OL')" class="icon small hourglass primary" />
                <span v-if="payment.isFailed" v-tooltip="$t('%1D5')" class="icon small disabled error" />
            </h1>

            <template v-if="canWrite">
                <p v-if="payment.type === PaymentType.Reallocation">
                    {{ $t('%hC', {platform: platform.config.name}) }}
                </p>
                <p v-if="payment.method === PaymentMethod.Transfer && payment.isFailed" class="error-box">
                    {{ $t('%hD') }}
                </p>

                <p v-if="payment.isPending && payment.method === PaymentMethod.Transfer && payment.isOverDue && payment.type == PaymentType.Payment" class="warning-box">
                    {{ $t('%hE') }}
                </p>

                <p v-if="payment.isPending && payment.type == PaymentType.Refund && !payment.provider" class="warning-box">
                    {{ $t("%hV") }}
                </p>

                <p v-if="payment.isPending && payment.type == PaymentType.Refund && payment.provider" class="info-box">
                    {{ $t('%Zaa') }}
                </p>
            </template>

            <p v-if="payment.refundedAmount" class="warning-box">
                {{ $t('%1Ug', {price: formatPrice(payment.refundedAmount)}) }}
            </p>

            <p v-if="payment.pendingRefundAmount" class="warning-box">
                {{ $t('%Zai', {price: formatPrice(-payment.pendingRefundAmount)}) }}
            </p>
            <p v-if="!payment.customer" class="info-box">
                {{ $t('%hO') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList class="info">
                <STListItem v-if="payment.method === 'Transfer'">
                    <h3 class="style-definition-label">
                        {{ $t('%J8') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ payment.transferDescription }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.method === 'Transfer' && payment.transferSettings">
                    <h3 v-if="payment.price >= 0" class="style-definition-label">
                        {{ $t('%hG') }}
                    </h3>
                    <h3 v-else class="style-definition-label">
                        {{ $t('%hH') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ payment.transferSettings }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.paidAt && (payment.type === PaymentType.Payment || payment.type === PaymentType.Refund)">
                    <h3 v-if="payment.price == 0" class="style-definition-label">
                        {{ $t('%16v') }}
                    </h3>
                    <h3 v-else-if="payment.price >= 0" class="style-definition-label">
                        {{ $t('%wY') }}
                    </h3>
                    <h3 v-else class="style-definition-label">
                        {{ $t('%h1') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateTime(payment.paidAt) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%1JJ') }} {{ formatDateTime(payment.createdAt) }}
                    </p>
                </STListItem>

                <STListItem v-else-if="isManualMethod || !(payment.paidAt && (payment.type === PaymentType.Payment || payment.type === PaymentType.Refund))">
                    <h3 class="style-definition-label">
                        {{ $t('%1JJ') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateTime(payment.createdAt) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%hI', {time: formatTime(payment.createdAt)}) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.iban">
                    <h3 class="style-definition-label">
                        {{ payment.method === PaymentMethod.CreditCard ?
                            $t('%MH')
                            : $t('%hJ')
                        }}
                    </h3>

                    <p class="style-definition-text">
                        {{ Formatter.iban(payment.iban) }}
                    </p>
                    <p v-if="payment.ibanName" class="style-description-small">
                        {{ $t('%hK', {name: payment.ibanName}) }}
                    </p>
                </STListItem>

                <STListItem v-else-if="payment.ibanName">
                    <h3 class="style-definition-label">
                        {{ $t('%Zba') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ payment.ibanName }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.settlement" class="right-description right-stack">
                    <h3 class="style-definition-label">
                        {{ $t('%hL') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ formatDate(payment.settlement.settledAt) }}<br>
                    </p>
                </STListItem>

                <STListItem v-if="payment.transferFee">
                    <h3 class="style-definition-label">
                        {{ $t('%hM') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ formatPrice(payment.transferFee) }}
                    </p>
                    <p class="style-description-small">
                        <template v-if="VATPercentage > 0">
                            {{ $t('%hN', {percentage: VATPercentage.toString()}) }}
                        </template> <a :href="$domains.getDocs('transactiekosten-inhouding')" class="inline-link" target="_blank">{{ $t('%19t') }}</a>
                    </p>
                </STListItem>

                <STListItem v-if="payment.serviceFeePayout">
                    <h3 class="style-definition-label">
                        {{ $t('%1Zu') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ formatPrice(payment.serviceFeePayout) }}
                    </p>
                    <p class="style-description-small">
                        <template v-if="VATPercentage > 0">
                            {{ $t('%hN', {percentage: VATPercentage.toString()}) }}
                        </template> <a :href="$domains.getDocs('transactiekosten-inhouding')" class="inline-link" target="_blank">{{ $t('%19t') }}</a>
                    </p>
                </STListItem>

                <STListItem v-if="payment.serviceFeeManualCharged">
                    <h3 class="style-definition-label">
                        {{ $t('%1Zu') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ formatPrice(payment.serviceFeeManualCharged) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%1by') }}
                    </p>
                </STListItem>

                <STListItem v-else-if="payment.serviceFeeManual">
                    <h3 class="style-definition-label">
                        {{ $t('%1Zu') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ formatPrice(payment.serviceFeeManual) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%1Yn') }}
                    </p>
                </STListItem>

                <STListItem v-if="canWrite && payment.invoiceId" :selectable="true" @click="openInvoice">
                    <h3 class="style-definition-label">
                        {{ $t('%1Mm') }}
                    </h3>
                    <p class="style-definition-text with-icons">
                        <span>{{ $t('%1JO') }}</span>
                        <span class="icon success small primary" />
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="payment.payingOrganization">
                    <h3 class="style-definition-label">
                        {{ $t('%1PI') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.payingOrganization.name }}
                    </p>
                    <p v-copyable class="style-description style-copyable">
                        {{ payment.payingOrganization.uri }}
                    </p>

                    <template #right>
                        <OrganizationAvatar v-if="payment.payingOrganization" :organization="payment.payingOrganization" />
                    </template>
                </STListItem>

                <STListItem v-if="payment.customer">
                    <h3 class="style-definition-label">
                        {{ $t('%1Ke') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer?.dynamicName }}
                    </p>
                    <p v-if="payment.customer?.company?.VATNumber" v-copyable class="style-description-small style-copyable">
                        {{ Formatter.VATNumber(payment.customer.company.VATNumber) }}
                    </p>
                    <p v-else-if="payment.customer?.company?.companyNumber" v-copyable class="style-description-small style-copyable">
                        {{ payment.customer.company.companyNumber }}
                    </p>
                    <p v-if="payment.customer?.company?.administrationEmail" class="style-description-small">
                        <EmailAddress :email="payment.customer.company.administrationEmail" />
                    </p>
                    <p v-if="payment.customer?.company?.customPeppolEndpointId" v-copyable class="style-description-small style-copyable">
                        {{ payment.customer.company.customPeppolEndpointId.getShortLabel() }}
                    </p>
                    <p v-if="payment.customer?.email" class="style-description-small">
                        <EmailAddress :email="payment.customer.email" />
                    </p>
                    <p v-if="payment.customer?.phone" v-copyable class="style-description-small style-copyable">
                        {{ payment.customer.phone }}
                    </p>
                    <p v-if="payment.customer?.company?.address" v-copyable class="style-description-small style-copyable">
                        {{ payment.customer?.company?.address }}
                    </p>
                </STListItem>
            </STList>

            <p><br></p>

            <PaymentItemsBox v-if="payment.balanceItemPayments.length" :payment="payment" :can-write="canWrite" />

            <template v-if="receivableBalances.length">
                <hr>
                <h2>{{ $t('%1aB') }}</h2>
                <STList>
                    <STListItem v-for="balance in receivableBalances" :key="balance.objectType + '/' + balance.objectId" :selectable="true" @click="openReceivableBalance(balance)">
                        <template #left>
                            <IconContainer :icon="balance.objectType === ReceivableBalanceType.organization ? 'company' : 'user'" />
                        </template>
                        <h3 class="style-title-list">
                            {{ balance.name }}
                        </h3>
                        <p class="style-description-small">
                            {{ capitalizeFirstLetter(getReceivableBalanceTypeName(balance.objectType)) }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <ActionButtonsBox :title="$t('%16X')" :actions="paymentActions" />
        </main>
    </div>
</template>

<script lang="ts" setup>

import { useAppContext } from '#context/appContext.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { GlobalEventBus } from '#EventBus.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useBackForward } from '#hooks/useBackForward.ts';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { Toast } from '#overlays/Toast.ts';
import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import type { BalanceItem } from '@stamhoofd/structures';
import { AccessRight, BalanceItemPaymentDetailed, BalanceItemRelationType, Company, DetailedReceivableBalance, getReceivableBalanceTypeName, Invoice, LimitedFilteredRequest, Payment, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentProvider, PaymentStatus, PaymentType, PaymentTypeHelper, PermissionLevel, ReceivableBalanceType } from '@stamhoofd/structures';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import PromiseView from '#containers/PromiseView.vue';
import { useInvoicesObjectFetcher } from '#fetchers/useInvoicesObjectFetcher.ts';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import OrganizationAvatar from '../context/OrganizationAvatar.vue';

import IconContainer from '#icons/IconContainer.vue';
import type { ActionButton } from './components/ActionButtonsBox.vue';
import ActionButtonsBox from './components/ActionButtonsBox.vue';
import PaymentItemsBox from './PaymentItemsBox.vue';
import EmailAddress from '#email/EmailAddress.vue';

const props = withDefaults(
    defineProps<{
        payment: PaymentGeneral;
        getNext?: ((payment: PaymentGeneral) => PaymentGeneral | null) | null;
        getPrevious?: ((payment: PaymentGeneral) => PaymentGeneral | null) | null;
    }>(), {
        getNext: null,
        getPrevious: null,
    },
);

const { hasNext, hasPrevious, goBack, goForward } = useBackForward('payment', props);
const errors = useErrors();
const title = computed(() => props.payment.title);
const isManualMethod = computed(() => props.payment.method === PaymentMethod.Transfer || props.payment.method === PaymentMethod.PointOfSale || props.payment.method === PaymentMethod.Unknown);
const auth = useAuth();
const app = useAppContext();
const canWrite = computed(() => app === 'dashboard' && auth.canAccessPayment(props.payment, PermissionLevel.Write));

// Refunding via the payment provider is only possible for Mollie payments (for now)
// (note: refundedAmount and pendingRefundAmount are negative)
const canRefundOnline = computed(() => {
    return props.payment.provider === PaymentProvider.Mollie
        && props.payment.isSucceeded
        && props.payment.type === PaymentType.Payment
        && props.payment.price + props.payment.refundedAmount + props.payment.pendingRefundAmount > 0
        && props.payment.organizationId === organization.value?.id;
});

// The action buttons are only shown for manual methods, when invoices are enabled or when an online refund is possible
const canShowActions = computed(() => canWrite.value && (isManualMethod.value || !!organization.value?.meta.invoicesEnabled || canRefundOnline.value));

const paymentActions = computed<ActionButton[]>(() => {
    const payment = props.payment;
    const canShow = canShowActions.value;

    return [
        {
            name: $t('%ZaM'),
            description: $t('%Zaj'),
            icon: 'card',
            iconClass: 'error',
            asideIcon: 'undo small',
            listItemClass: 'theme-error',
            testId: 'refund-online-button',
            enabled: canShow && canRefundOnline.value,
            action: refundOnline,
        },
        {
            name: $t('%hP'),
            description: $t('%hW'),
            icon: 'bank',
            iconClass: 'primary',
            asideIcon: 'clock small',
            enabled: canShow && payment.isFailed && payment.type === PaymentType.Payment,
            action: markPending,
        },
        {
            name: $t('%1JQ'),
            description: payment.webshopIds.length ? $t('%hQ') : undefined,
            icon: 'bank',
            iconClass: 'success',
            asideIcon: 'success small',
            enabled: canShow && ((payment.canChangeStatus && payment.isPending && payment.type === PaymentType.Payment) || (payment.isFailed && payment.type !== PaymentType.Payment)),
            action: markPaid,
        },
        {
            name: $t('%hR'),
            description: payment.method === PaymentMethod.Transfer ? $t('%hS') : $t('%hT'),
            icon: 'bank',
            iconClass: 'primary',
            asideIcon: 'clock small',
            enabled: canShow && payment.isSucceeded && payment.type === PaymentType.Payment && payment.canChangeStatus,
            action: markPending,
        },
        {
            name: $t('%1Lh'),
            description: payment.type !== PaymentType.Payment ? $t('%hU') : (payment.method === PaymentMethod.Transfer ? $t('%1K0') : $t('%1K1')),
            icon: 'bank',
            iconClass: 'error',
            asideIcon: 'canceled small',
            enabled: canShow && !payment.invoiceId && payment.canChangeStatus && (payment.isPending || (payment.isSucceeded && payment.type !== PaymentType.Payment && payment.type !== PaymentType.Reallocation)),
            action: markFailed,
        },
        {
            name: $t('%1K2'),
            description: $t('%1K3'),
            icon: 'receipt',
            iconClass: 'primary',
            asideIcon: 'add small',
            enabled: canShow && !!organization.value?.meta.invoicesEnabled && !payment.invoiceId,
            action: createInvoice,
        },
    ];
});

const VATPercentage = 21; // todo
const context = useContext();
const owner = useRequestOwner();
const markingPaid = ref(false);
const platform = usePlatform();
const present = usePresent();
const show = useShow();
const organization = useOrganization();

async function reload() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/payments/${props.payment.id}`,
            decoder: PaymentGeneral as Decoder<PaymentGeneral>,
            owner,
            shouldRetry: true,
        });
        props.payment.deepSet(response.data);
    } catch (e) {
        Toast.fromError(e).show();
    }
}

async function editPayment() {
    await reload();
    await present({
        components: [
            AsyncComponent(() => import('./EditPaymentView.vue'), {
                payment: props.payment,
                isNew: false,
                balanceItems: [],
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function markPaid() {
    if (!await CenteredMessage.confirm($t('%1K5'), $t('%1K6'), undefined, undefined, false)) {
        return;
    }
    await mark(PaymentStatus.Succeeded);
}

async function markPending() {
    if (props.payment.status === PaymentStatus.Succeeded) {
        if (!await CenteredMessage.confirm($t('%1K7'), $t('%1K8'), $t('%1K9'), undefined, false)) {
            return;
        }
    } else {
        if (!await CenteredMessage.confirm($t('%1KA'), $t('%1KB'), $t('%1KC'), undefined, false)) {
            return;
        }
    }
    await mark(PaymentStatus.Pending);
}

async function markFailed() {
    if (!await CenteredMessage.confirm($t('%1KD'), $t('%1Jy'), $t('%1KE'))) {
        return;
    }
    await mark(PaymentStatus.Failed);
}

async function mark(status: PaymentStatus) {
    if (markingPaid.value) {
        return;
    }

    markingPaid.value = true;

    try {
        const data: PatchableArrayAutoEncoder<Payment> = new PatchableArray();
        data.addPatch(Payment.patch({
            id: props.payment.id,
            status,
        }));

        // Create a patch for this payment
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization/payments',
            body: data,
            decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
            shouldRetry: false,
        });
        props.payment.deepSet(response.data[0]);
        GlobalEventBus.sendEvent('paymentPatch', props.payment).catch(console.error);
        Toast.success($t(`%Mb`)).setHide(1000).show();
    } catch (e) {
        Toast.fromError(e).show();
    }
    markingPaid.value = false;
}

async function refundOnline() {
    await reload();

    // Default: fully reverse the items of this payment (the user can deselect or lower amounts)
    const fullPrices = new Map<string, number>();
    for (const item of props.payment.balanceItemPayments) {
        fullPrices.set(item.balanceItem.id, (fullPrices.get(item.balanceItem.id) ?? 0) - item.price);
    }
    const balanceItems = [...new Map(props.payment.balanceItemPayments.map(p => [p.balanceItem.id, p.balanceItem])).values()];

    const refund = PaymentGeneral.create({
        type: PaymentType.Refund,
        // Refund online via this payment by default (the user can still switch to
        // e.g. a manual transfer in the view)
        reversingPaymentId: props.payment.id,
        method: props.payment.method,
        status: PaymentStatus.Succeeded,
        paidAt: new Date(),
        customer: props.payment.customer,
        payingOrganization: props.payment.payingOrganization,
        payingOrganizationId: props.payment.payingOrganizationId,
        payingUserId: props.payment.payingUserId,
        balanceItemPayments: balanceItems.map(balanceItem => BalanceItemPaymentDetailed.create({
            balanceItem,
            price: fullPrices.get(balanceItem.id) ?? 0,
        })),
    });

    await present({
        components: [
            AsyncComponent(() => import('./EditPaymentView.vue'), {
                payment: refund,
                isNew: true,
                balanceItems,
                getFullPrice: (item: BalanceItem) => fullPrices.get(item.id) ?? 0,
                refundablePayments: [props.payment],
                saveHandler: async () => {
                    // Reload the refunded payment (refundedAmount changed)
                    await reload();
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function viewAudit() {
    await present({
        components: [
            AsyncComponent(() => import('#audit-logs/AuditLogsView.vue'), {
                objectIds: [props.payment.id],
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function createInvoice() {
    if (!canWrite.value) {
        return;
    }

    try {
        const invoice = Invoice.create({
            seller: organization.value?.defaultCompanies[0] ?? Company.create({}),
            customer: props.payment.customer ?? PaymentCustomer.create({}),
            payments: [props.payment],
        });
        invoice.buildFromPayments();

        const component = AsyncComponent(() => import('./EditInvoiceView.vue'), {
            invoice,
            isNew: true,
            saveHandler: (updated: Invoice) => {
            },
        });
        await present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: component,
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    } catch (e) {
        Toast.fromError(e).show();
    }
}
type ReceivableBalanceRef = {
    objectType: ReceivableBalanceType;
    objectId: string;
    name: string;
};

const receivableBalances = computed<ReceivableBalanceRef[]>(() => {
    const payment = props.payment;
    if (app !== 'dashboard' || !auth.hasAccessRight(AccessRight.OrganizationFinanceDirector) || payment.organizationId !== organization.value?.id) {
        return [];
    }

    const map = new Map<string, ReceivableBalanceRef>();
    const add = (objectType: ReceivableBalanceType, objectId: string, name: string | null) => {
        const key = objectType + '/' + objectId;
        if (!map.has(key)) {
            map.set(key, { objectType, objectId, name: name || Formatter.capitalizeFirstLetter(getReceivableBalanceTypeName(objectType)) });
        }
    };

    if (payment.payingOrganizationId) {
        add(ReceivableBalanceType.organization, payment.payingOrganizationId, payment.payingOrganization?.name ?? null);
    }

    for (const { balanceItem } of payment.balanceItemPayments) {
        if (balanceItem.payingOrganizationId) {
            add(ReceivableBalanceType.organization, balanceItem.payingOrganizationId, balanceItem.payingOrganizationId === payment.payingOrganizationId ? (payment.payingOrganization?.name ?? null) : null);
        } else if (balanceItem.memberId) {
            add(ReceivableBalanceType.member, balanceItem.memberId, balanceItem.relations.get(BalanceItemRelationType.Member)?.name.toString() ?? null);
        } else if (balanceItem.userId) {
            add(ReceivableBalanceType.userWithoutMembers, balanceItem.userId, balanceItem.userId === payment.payingUserId ? (payment.customer?.name ?? null) : null);
        }
    }

    return [...map.values()];
});

async function openReceivableBalance(balance: ReceivableBalanceRef) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(PromiseView, {
                    promise: async () => {
                        const response = await context.value.authenticatedServer.request({
                            method: 'GET',
                            path: `/receivable-balances/${balance.objectType}/${balance.objectId}`,
                            decoder: DetailedReceivableBalance as Decoder<DetailedReceivableBalance>,
                            owner,
                        });
                        return AsyncComponent(() => import('./ReceivableBalanceView.vue'), {
                            item: response.data,
                            getNext: () => null,
                            getPrevious: () => null,
                        });
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const fetchInvoice = useInvoicesObjectFetcher();
async function openInvoice() {
    if (!props.payment.invoiceId) {
        return;
    }

    try {
        const result = await fetchInvoice.fetch(new LimitedFilteredRequest({
            filter: {
                id: props.payment.invoiceId,
            },
            limit: 1,
        }));
        if (result.results.length === 1) {
            const invoice = result.results[0];
            await show({
                components: [
                    AsyncComponent(() => import('./InvoiceView.vue'), {
                        invoice,
                    }),
                ],
            });
        } else {
            throw new SimpleError({
                code: 'not_found',
                message: $t('%1dK'),
            });
        }
    } catch (e) {
        Toast.fromError(e).show();
    }
}
</script>
