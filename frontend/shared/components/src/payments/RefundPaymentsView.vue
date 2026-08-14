<template>
    <SaveView
        :title="title"
        :loading="refunding"
        :disabled="!isConfirmed"
        :save-text="$t('%ZaM')"
        save-icon="undo"
        save-button-class="destructive"
        :add-extra-cancel="true"
        data-testid="refund-payments-view"
        @save="refund"
    >
        <h1>{{ title }}</h1>
        <p>{{ $t('%Zl3') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem data-testid="refundable-count">
                <h3 class="style-definition-label">
                    {{ $t('%ZlC') }}
                </h3>
                <p class="style-definition-text">
                    {{ pluralText(refundablePayments.length, $t('%14a'), $t('%Zj2')) }}
                </p>

                <template #right>
                    <span class="style-price-base negative">{{ formatPrice(-refundableTotal) }}</span>
                </template>
            </STListItem>

            <STListItem v-if="notViaMollie.length" data-testid="not-via-mollie-count">
                <h3 class="style-definition-label">
                    {{ $t('%Zl9') }}
                </h3>
                <p class="style-definition-text">
                    {{ pluralText(notViaMollie.length, $t('%14a'), $t('%Zj2')) }}
                </p>
            </STListItem>

            <STListItem v-if="notRefundable.length" data-testid="not-refundable-count">
                <h3 class="style-definition-label">
                    {{ $t('%Zl1') }}
                </h3>
                <p class="style-definition-text">
                    {{ pluralText(notRefundable.length, $t('%14a'), $t('%Zj2')) }}
                </p>
            </STListItem>
        </STList>

        <p v-if="notViaMollie.length || notRefundable.length" class="style-description-small">
            {{ $t('%Zl6') }}
        </p>

        <template v-if="refundablePayments.length">
            <hr>

            <STInputBox :title="$t('%Zkz')" error-fields="confirmationCode">
                <input
                    v-model="confirmationCode"
                    class="input"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    data-testid="refund-confirmation-input"
                    :placeholder="refundablePayments.length.toString()"
                >
            </STInputBox>
        </template>
        <p v-else class="info-box">
            {{ $t('%ZlB') }}
        </p>

        <p v-if="refunding" class="style-description-small">
            {{ $t('%Zl7', {count: progress, total: progressTotal}) }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { BalanceItemPaymentDetailed, PaymentGeneral, PaymentProvider, PaymentStatus, PaymentType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { GlobalEventBus } from '#EventBus.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import STInputBox from '#inputs/STInputBox.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import SaveView from '#navigation/SaveView.vue';
import { Toast } from '#overlays/Toast.ts';

const props = withDefaults(
    defineProps<{
        payments: PaymentGeneral[];
        /**
         * Called after at least one payment was refunded, e.g. to reload the table the selection
         * came from: the refunds are new payments and the source payments changed.
         */
        onRefunded?: (() => Promise<void> | void) | null;
    }>(), {
        onRefunded: null,
    },
);

const title = $t('%ZlE');
const errors = useErrors();
const context = useContext();
const organization = useOrganization();
const pop = usePop();

const confirmationCode = ref('');
const refunding = ref(false);
const progress = ref(0);
const progressTotal = ref(0);

/**
 * Payments that already got a refund in this view: they stay in the selection (props are not
 * reloaded), but may never be refunded a second time when the user retries after a failure.
 */
const refundedIds = ref(new Set<string>());

/**
 * A payment can only be refunded via the API of Mollie when it fully succeeded and nothing of it
 * was reversed yet: a partial refund needs the amounts per article, which only the payment itself
 * knows. Note that refundedAmount and pendingRefundAmount are negative.
 */
function canRefundOnline(payment: PaymentGeneral) {
    return payment.isSucceeded
        && payment.type === PaymentType.Payment
        && payment.price > 0
        && payment.refundedAmount === 0
        && payment.pendingRefundAmount === 0
        && payment.organizationId === organization.value?.id;
}

const remainingPayments = computed(() => props.payments.filter(p => !refundedIds.value.has(p.id)));

const refundablePayments = computed(() => remainingPayments.value.filter(p => p.provider === PaymentProvider.Mollie && canRefundOnline(p)));
const notViaMollie = computed(() => remainingPayments.value.filter(p => p.provider !== PaymentProvider.Mollie));
const notRefundable = computed(() => remainingPayments.value.filter(p => p.provider === PaymentProvider.Mollie && !canRefundOnline(p)));

const refundableTotal = computed(() => refundablePayments.value.reduce((total, payment) => total + payment.price, 0));

const isConfirmed = computed(() => refundablePayments.value.length > 0 && confirmationCode.value.trim() === refundablePayments.value.length.toString());

/**
 * Fully reverse a payment: every article of the payment is refunded for the amount that was paid
 * for it.
 */
function buildRefund(payment: PaymentGeneral): PaymentGeneral {
    const prices = new Map<string, number>();
    for (const item of payment.balanceItemPayments) {
        prices.set(item.balanceItem.id, (prices.get(item.balanceItem.id) ?? 0) - item.price);
    }
    const balanceItems = [...new Map(payment.balanceItemPayments.map(p => [p.balanceItem.id, p.balanceItem])).values()];

    return PaymentGeneral.create({
        type: PaymentType.Refund,
        // Refund via the payment provider of this payment
        reversingPaymentId: payment.id,
        method: payment.method,
        status: PaymentStatus.Succeeded,
        paidAt: new Date(),
        customer: payment.customer,
        payingOrganization: payment.payingOrganization,
        payingOrganizationId: payment.payingOrganizationId,
        payingUserId: payment.payingUserId,
        balanceItemPayments: balanceItems.map(balanceItem => BalanceItemPaymentDetailed.create({
            balanceItem,
            price: prices.get(balanceItem.id) ?? 0,
        })),
    });
}

function describe(payment: PaymentGeneral) {
    return payment.customer?.dynamicName || payment.getShortDescription() || payment.id.substring(0, 8);
}

/**
 * Refund one payment at a time: a refund that failed at Mollie may not stop the other refunds, and
 * the user has to know exactly which payments were refunded.
 */
async function refund() {
    if (refunding.value || !isConfirmed.value) {
        return;
    }

    const payments = refundablePayments.value;

    refunding.value = true;
    errors.errorBox = null;
    progress.value = 0;
    progressTotal.value = payments.length;

    const failures = new SimpleErrors();

    for (const payment of payments) {
        try {
            const body: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
            body.addPut(buildRefund(payment));

            const response = await context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/payments',
                body,
                decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
                shouldRetry: false,
            });

            refundedIds.value.add(payment.id);

            for (const created of response.data) {
                GlobalEventBus.sendEvent('paymentPatch', created).catch(console.error);
            }
        }
        catch (e) {
            const message = isSimpleError(e) || isSimpleErrors(e) ? e.getHuman() : (e as Error).message;
            failures.addError(new SimpleError({
                code: 'refund_failed',
                message: 'Failed to refund payment ' + payment.id,
                human: $t('%ZlA', { description: describe(payment), error: message }),
            }));
        }

        progress.value += 1;
    }

    refunding.value = false;
    confirmationCode.value = '';

    const succeeded = payments.length - failures.errors.length;

    if (succeeded > 0) {
        Toast.success(
            succeeded === 1 ? $t('%Zl8') : $t('%Zky', { count: succeeded }),
        ).show();

        if (props.onRefunded) {
            await props.onRefunded();
        }
    }

    if (failures.errors.length > 0) {
        // Keep the view open: the summary now only lists the payments that still need a refund
        errors.errorBox = new ErrorBox(failures);
        return;
    }

    await pop({ force: true });
}
</script>
