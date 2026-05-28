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

                <span v-if="payment.isPending" v-tooltip="$t('%1PL')" class="icon small hourglass primary" />
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

                <p v-if="payment.isPending && payment.type == PaymentType.Refund" class="warning-box">
                    {{ $t("%hV") }}
                </p>
            </template>

            <p v-if="payment.refundedAmount" class="warning-box">
                {{ $t('Deze betaling werd intussen terugbetaald of teruggevorderd voor {price} in een andere betaling.', {price: formatPrice(payment.refundedAmount)}) }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList class="info">
                <STListItem v-if="payment.price">
                    <h3 class="style-definition-label">
                        {{ $t('%hF') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(payment.price) }}
                    </p>
                </STListItem>

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

                <STListItem v-if="isManualMethod">
                    <h3 class="style-definition-label">
                        {{ $t('%1JJ') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(payment.createdAt) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%hI', {time: formatTime(payment.createdAt)}) }}
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
                        {{ formatDate(payment.paidAt) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%hI', {time: formatTime(payment.paidAt)}) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.iban">
                    <h3 class="style-definition-label">
                        {{ $t('%hJ') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ Formatter.iban(payment.iban) }}
                    </p>
                    <p v-if="payment.ibanName" class="style-description-small">
                        {{ $t('%hK', {name: payment.ibanName}) }}
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
                        {{ $t('Servicekost') }}
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
                        {{ $t('Servicekost') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ formatPrice(payment.serviceFeeManualCharged) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Excl. BTW - Dit bedrag werd reeds aangerekend') }}
                    </p>
                </STListItem>

                <STListItem v-else-if="payment.serviceFeeManual">
                    <h3 class="style-definition-label">
                        {{ $t('Servicekost') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ formatPrice(payment.serviceFeeManual) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Excl. BTW - Dit bedrag wordt achteraf aangerekend via jouw ingestelde betaalmethode.') }}
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
            </STList>

            <hr><h2>{{ $t('%1Ke') }}</h2>

            <p v-if="!payment.customer" class="info-box">
                {{ $t('%hO') }}
            </p>
            <STList v-else class="info">
                <STListItem v-if="payment.payingOrganization">
                    <h3 class="style-definition-label">
                        {{ $t('%1Kj') }}
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

                <template v-if="payment.customer.company">
                    <STListItem>
                        <h3 class="style-definition-label">
                            {{ $t('%1JI') }}
                        </h3>
                        <p v-copyable class="style-definition-text style-copyable">
                            {{ payment.customer.company.name }}
                        </p>
                        <p v-if="!payment.customer.company.VATNumber && !payment.customer.company.companyNumber" class="style-description">
                            {{ $t('%1CH') }}
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.customer.company.VATNumber">
                        <h3 class="style-definition-label">
                            {{ $t('%1CK') }}
                        </h3>
                        <p v-copyable class="style-definition-text style-copyable">
                            {{ payment.customer.company.VATNumber || 'Niet BTW-plichtig' }}
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.customer.company.companyNumber && (!payment.customer.company.VATNumber || (payment.customer.company.companyNumber !== payment.customer.company.VATNumber && payment.customer.company.companyNumber !== payment.customer.company.VATNumber.slice(2)))">
                        <h3 class="style-definition-label">
                            {{ $t('%wa') }}
                        </h3>
                        <p v-copyable class="style-definition-text style-copyable">
                            {{ payment.customer.company.companyNumber || 'Niet BTW-plichtig' }}
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.customer.company.address">
                        <h3 class="style-definition-label">
                            {{ $t('%Cn') }}
                        </h3>
                        <p v-copyable class="style-definition-text style-copyable">
                            {{ payment.customer.company.address.toString() }}
                        </p>
                    </STListItem>

                    <STListItem v-if="payment.customer.company.administrationEmail">
                        <h3 class="style-definition-label">
                            {{ $t('%1FK') }}
                        </h3>
                        <p class="style-definition-text">
                            <EmailAddress :email="payment.customer.company.administrationEmail" />
                        </p>
                    </STListItem>
                </template>

                <STListItem v-if="!payment.customer.company || payment.customer.name">
                    <h3 class="style-definition-label">
                        {{ $t('%1Kl') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.name || $t('%CL') }}
                    </p>
                    <p v-if="payment.customer.email" v-copyable class="style-description">
                        <EmailAddress :email="payment.customer.email" />
                    </p>
                    <p v-if="payment.customer.phone" v-copyable class="style-description style-copyable">
                        {{ payment.customer.phone }}
                    </p>
                </STListItem>
            </STList>

            <template v-if="(isManualMethod || organization?.meta.invoicesEnabled) && canWrite">
                <hr><h2>{{ $t('%16X') }}</h2>

                <STList>
                    <STListItem v-if="payment.isFailed && payment.type === PaymentType.Payment" :selectable="true" @click="markPending">
                        <template #left>
                            <IconContainer icon="bank" class="primary">
                                <template #aside>
                                    <span class="icon clock small" />
                                </template>
                            </IconContainer>
                        </template>

                        <h2 class="style-title-list">
                            {{ $t('%hP') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t("%hW") }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="(payment.isPending && payment.type === PaymentType.Payment) || (payment.isFailed && payment.type !== PaymentType.Payment)" :selectable="true" @click="markPaid">
                        <template #left>
                            <IconContainer icon="bank" class="success">
                                <template #aside>
                                    <span class="icon success small" />
                                </template>
                            </IconContainer>
                        </template>

                        <h2 class="style-title-list">
                            {{ $t('%1JQ') }}
                        </h2>
                        <p v-if="payment.webshopIds.length" class="style-description-small">
                            {{ $t('%hQ') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="payment.isSucceeded && payment.type === PaymentType.Payment" :selectable="true" @click="markPending">
                        <template #left>
                            <IconContainer icon="bank" class="primary">
                                <template #aside>
                                    <span class="icon clock small" />
                                </template>
                            </IconContainer>
                        </template>

                        <h2 class="style-title-list">
                            {{ $t('%hR') }}
                        </h2>
                        <p v-if="payment.method === 'Transfer'" class="style-description-small">
                            {{ $t('%hS') }}
                        </p>
                        <p v-else class="style-description-small">
                            {{ $t('%hT') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!payment.invoiceId && (payment.isPending || (payment.isSucceeded && payment.type !== PaymentType.Payment && payment.type !== PaymentType.Reallocation))" :selectable="true" @click="markFailed">
                        <template #left>
                            <IconContainer icon="bank" class="error">
                                <template #aside>
                                    <span class="icon canceled small" />
                                </template>
                            </IconContainer>
                        </template>

                        <h2 class="style-title-list">
                            {{ $t('%1Lh') }}
                        </h2>
                        <p v-if="payment.type !== PaymentType.Payment" class="style-description-small">
                            {{ $t('%hU') }}
                        </p>
                        <p v-else-if="payment.method === 'Transfer'" class="style-description-small">
                            {{ $t('%1K0') }}
                        </p>
                        <p v-else class="style-description-small">
                            {{ $t('%1K1') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="organization?.meta.invoicesEnabled && !payment.invoiceId" :selectable="true" @click="createInvoice">
                        <template #left>
                            <IconContainer icon="receipt" class="primary">
                                <template #aside>
                                    <span class="icon add small" />
                                </template>
                            </IconContainer>
                        </template>

                        <h2 class="style-title-list">
                            {{ $t('%1K2') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('%1K3') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="payment.balanceItemPayments.length">
                <hr><h2>{{ $t('%YI') }}</h2>
                <p v-if="organization?.meta.invoicesEnabled">
                    {{ $t('%1K4') }}
                </p>

                <PaymentItemsBox :payment="payment" :can-write="canWrite" />
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import AuditLogsView from '#audit-logs/AuditLogsView.vue';
import { useAppContext } from '#context/appContext.ts';
import EmailAddress from '#email/EmailAddress.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { GlobalEventBus } from '#EventBus.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useBackForward } from '#hooks/useBackForward.ts';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import IconContainer from '#icons/IconContainer.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { Toast } from '#overlays/Toast.ts';
import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { Company, Invoice, LimitedFilteredRequest, Payment, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentStatus, PaymentType, PaymentTypeHelper, PermissionLevel } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import OrganizationAvatar from '../context/OrganizationAvatar.vue';
import { useInvoicesObjectFetcher } from '../fetchers';
import EditInvoiceView from './EditInvoiceView.vue';
import EditPaymentView from './EditPaymentView.vue';
import InvoiceView from './InvoiceView.vue';
import PaymentItemsBox from './PaymentItemsBox.vue';

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
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function editPayment() {
    await reload();
    await present({
        components: [
            new ComponentWithProperties(EditPaymentView, {
                payment: props.payment,
                isNew: false,
                balanceItems: [],
                saveHandler: async (patch: AutoEncoderPatchType<PaymentGeneral>) => {
                    const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
                    arr.addPatch(patch);
                    const response = await context.value.authenticatedServer.request({
                        method: 'PATCH',
                        path: '/organization/payments',
                        body: arr,
                        decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
                        shouldRetry: false,
                    });

                    const updatedPayment = response.data.find(p => p.id === props.payment.id);
                    if (updatedPayment) {
                        props.payment.deepSet(updatedPayment);
                    }
                    else {
                        await reload();
                    }
                },
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
    }
    else {
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
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    markingPaid.value = false;
}

async function viewAudit() {
    await present({
        components: [
            new ComponentWithProperties(AuditLogsView, {
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
            seller: organization.value?.meta.companies[0] ?? Company.create({}),
            customer: props.payment.customer ?? PaymentCustomer.create({}),
            payments: [props.payment],
        });
        invoice.buildFromPayments();

        const component = new ComponentWithProperties(EditInvoiceView, {
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
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}
const fetchInvoice = useInvoicesObjectFetcher()
async function openInvoice() {
    if (!props.payment.invoiceId) {
        return;
    }

    try {
        const result = await fetchInvoice.fetch(new LimitedFilteredRequest({
            filter: {
                id: props.payment.invoiceId
            },
            limit: 1
        }))
        if (result.results.length === 1) {
            const invoice = result.results[0];
            await show({
                components: [
                    new ComponentWithProperties(InvoiceView, {
                            invoice
                     })
                ],
            })
        } else {
            throw new SimpleError({
                code: 'not_found',
                message: $t('Deze factuur kon niet worden gevonden')
            })
        }
    } catch (e) {
        Toast.fromError(e).show()
    }
}
</script>
