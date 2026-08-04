import { Formatter } from '@stamhoofd/utility';
import type { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import type { Settlement } from './members/Payment.js';
import { OFFLINE_PAYMENT_METHODS, PaymentMethod, PaymentMethodHelper } from './PaymentMethod.js';
import { getPaymentProviderName, PaymentProvider } from './PaymentProvider.js';
import { PaymentStatus } from './PaymentStatus.js';

/**
 * The offline methods that actually bring money in. A deduction only moves money between two balances,
 * so it is grouped on its own instead of next to the money that arrived.
 */
const RECEIVED_OFFLINE_PAYMENT_METHODS = OFFLINE_PAYMENT_METHODS.filter(method => method !== PaymentMethod.AccountDeductions);

const ONLINE_PAYMENT_METHODS = Object.values(PaymentMethod).filter(method => !OFFLINE_PAYMENT_METHODS.includes(method));

/**
 * The providers that hold on to the money before paying it out, and that tell us when they did.
 */
export const SETTLING_PAYMENT_PROVIDERS = [PaymentProvider.Stripe, PaymentProvider.Mollie];

/**
 * Payments of these providers, and payments without one, are never part of a payout we know about.
 * Null is included because a payment doesn't always have a provider.
 */
const UNSETTLED_PAYMENT_PROVIDERS: (PaymentProvider | null)[] = [
    null,
    ...Object.values(PaymentProvider).filter(provider => !SETTLING_PAYMENT_PROVIDERS.includes(provider)),
];

/**
 * The statuses of a payment that is still on its way. Together with Succeeded and Failed these cover
 * every payment, so a breakdown per status never leaves anything out.
 */
export const PENDING_PAYMENT_STATUSES = [PaymentStatus.Created, PaymentStatus.Pending];

/**
 * What a payment needs to carry to know how it was paid out.
 */
export type SettleablePayment = {
    method: PaymentMethod;
    provider: PaymentProvider | null;
    settlement: Settlement | null;
    status: PaymentStatus;
};

export function isOnlinePayment(payment: { method: PaymentMethod }): boolean {
    return PaymentMethodHelper.isOnline(payment.method);
}

/**
 * Whether a payout is expected for this payment: only these providers hold on to the money before
 * paying it out, and only for them we know when they did.
 */
export function expectsSettlement(payment: { provider: PaymentProvider | null }): boolean {
    return payment.provider !== null && SETTLING_PAYMENT_PROVIDERS.includes(payment.provider);
}

/**
 * The payout a payment was part of: what a payment provider transferred to the bank account in one go,
 * for all the payments it settled together.
 *
 * Money that was never held by a provider, and money that is still waiting to be paid out, are grouped
 * in a payout of their own so every payment ends up in exactly one of them.
 */
export class PaymentSettlementGroup {
    /**
     * Stable identifier, used to add the payments of the same payout together.
     */
    id: string;
    name: string;
    description: string;
    icon: string;
    asideIcon?: string | null;

    /**
     * Selects the payments that were paid out here, so a breakdown can be narrowed down to this payout.
     */
    filter: StamhoofdFilter;

    constructor({ id, name, description, icon, filter, asideIcon }: { id: string; name: string; description?: string; icon: string; asideIcon?: string | null; filter: StamhoofdFilter }) {
        this.id = id;
        this.name = name;
        this.description = description ?? '';
        this.icon = icon;
        this.filter = filter;
        this.asideIcon = asideIcon;
    }
}

/**
 * Determines which payout a payment was part of.
 *
 * A payout is identified by the provider that made it, its reference and the moment it was settled:
 * that combination is what shows up on the bank account, so payments that arrived together are added
 * together, also when the provider split them over several settlements.
 *
 * Which group a payment lands in follows `expectsSettlement`, and so do the filters: every payment ends
 * up in exactly one group, and every group selects exactly the payments it holds.
 */
export function getPaymentSettlement(payment: SettleablePayment): PaymentSettlementGroup {
    // Money that never arrived was never paid out, so where it is depends on the payment itself
    if (payment.status !== PaymentStatus.Succeeded) {
        return payment.status === PaymentStatus.Failed ? getFailedPaymentGroup() : getPendingPaymentGroup();
    }

    if (expectsSettlement(payment)) {
        return payment.settlement
            ? getSettledGroup(payment.provider, payment.settlement)
            : new PaymentSettlementGroup({
                id: 'not-settled',
                name: $t('%Zjn'),
                description: $t('%Zjd'),
                icon: 'bank',
                asideIcon: 'clock',
                filter: {
                    $and: [
                        { status: PaymentStatus.Succeeded },
                        { provider: { $in: SETTLING_PAYMENT_PROVIDERS } },
                        { settlement: { settledAt: null } },
                    ],
                },
            });
    }

    if (payment.method === PaymentMethod.AccountDeductions) {
        return new PaymentSettlementGroup({
            id: ACCOUNT_DEDUCTIONS_ID,
            name: PaymentMethodHelper.getNameCapitalized(PaymentMethod.AccountDeductions),
            description: $t('%ZjO'),
            icon: 'sync',
            filter: {
                $and: [
                    { status: PaymentStatus.Succeeded },
                    { method: PaymentMethod.AccountDeductions },
                ],
            },
        });
    }

    if (isOnlinePayment(payment)) {
        // Per provider: without payout information the provider is the only thing that says where the
        // money is
        return new PaymentSettlementGroup({
            id: 'no-payout-info-' + (payment.provider ?? 'none'),
            name: payment.provider ? getPaymentProviderName(payment.provider) : $t('%Zja'),
            description: $t('%Zj7'),
            icon: 'card',
            asideIcon: 'help',
            filter: {
                $and: [
                    { status: PaymentStatus.Succeeded },
                    { method: { $in: ONLINE_PAYMENT_METHODS } },
                    { provider: payment.provider },
                ],
            },
        });
    }

    return new PaymentSettlementGroup({
        id: 'offline',
        name: $t('%ZjN'),
        description: $t('%ZiV'),
        icon: 'card-off',
        filter: {
            $and: [
                { status: PaymentStatus.Succeeded },
                { method: { $in: RECEIVED_OFFLINE_PAYMENT_METHODS } },
                { provider: { $in: UNSETTLED_PAYMENT_PROVIDERS } },
            ],
        },
    });
}

export const PENDING_PAYMENT_ID = 'pending';
export const FAILED_PAYMENT_ID = 'failed';
export const ACCOUNT_DEDUCTIONS_ID = 'account-deductions';

/**
 * Money that is on its way: the payment was started but is not finished, so nothing came in yet.
 */
export function getPendingPaymentGroup(): PaymentSettlementGroup {
    return new PaymentSettlementGroup({
        id: PENDING_PAYMENT_ID,
        name: $t('%1OL'),
        description: $t('%Ziv'),
        icon: 'clock',
        filter: { status: { $in: PENDING_PAYMENT_STATUSES } },
    });
}

export function getFailedPaymentGroup(): PaymentSettlementGroup {
    return new PaymentSettlementGroup({
        id: FAILED_PAYMENT_ID,
        name: $t('%ZjW'),
        description: $t('%ZjU'),
        icon: 'canceled',
        filter: { status: PaymentStatus.Failed },
    });
}

function getSettledGroup(provider: PaymentProvider | null, settlement: Settlement): PaymentSettlementGroup {
    const date = Formatter.date(settlement.settledAt, true);

    return new PaymentSettlementGroup({
        id: 'settlement-' + (provider ?? '') + '-' + settlement.reference + '-' + settlement.settledAt.getTime(),
        // Providers don't always fill in a reference, e.g. Stripe only does when a statement descriptor
        // is set on the account
        name: settlement.reference || $t('%MA'),
        description: provider
            ? $t('%ZjR', { date, provider: getPaymentProviderName(provider) })
            : $t('%ZaX', { date }),
        icon: 'download',
        filter: {
            $and: [
                // A payment that failed can still carry the payout it was meant to be part of
                { status: PaymentStatus.Succeeded },
                { provider },
                { settlement: { reference: settlement.reference } },
                { settlement: { settledAt: settlement.settledAt } },
            ],
        },
    });
}
