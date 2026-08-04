import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/email';
import { Payment, StripeAccount } from '@stamhoofd/models';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import type { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { PaymentProvider } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { SettlementStatus } from '@stamhoofd/structures/settlements/SettlementStatus.js';
import Stripe from 'stripe';

import { ReportedRows, SettlementService } from '../services/SettlementService.js';
import { passthroughFetch } from './passthroughFetch.js';
import type { StripePaymentIdCache } from './resolveStripePaymentId.js';
import { resolveStripePaymentId } from './resolveStripePaymentId.js';
import { StripeFeeSync } from './StripeFeeSync.js';
import { ApplicationFeeDetails } from './StripeInvoicer.js';

/**
 * Walks paid payouts and stores every balance transaction in them: payments become
 * payment_settlements rows, everything else becomes settlement_charges rows. One walker for both
 * scopes: `stripeAccount === null` walks our own platform account, otherwise the connected
 * account's payouts.
 *
 * Fail loudly: a transaction that can't be attributed or an unknown transaction type fails the
 * whole payout. The settlement stays unsynced (`syncedAt IS NULL`) and is retried later.
 */
export class StripePayoutSync {
    private stripe: Stripe;
    private stripePlatform: Stripe;
    private stripeAccount: StripeAccount | null;
    private feeSync: StripeFeeSync;
    readonly cache: StripePaymentIdCache;

    /**
     * Explicitly fetched charges (when an expansion came back as an id), per run.
     */
    private fetchedCharges = new Map<string, Stripe.Charge>();

    constructor({ secretKey, stripeAccount, cache }: { secretKey: string; stripeAccount?: StripeAccount | null; cache?: StripePaymentIdCache }) {
        this.stripeAccount = stripeAccount ?? null;
        this.cache = cache ?? new Map();
        this.feeSync = new StripeFeeSync({ secretKey, cache: this.cache });

        const options: Stripe.StripeConfig = {
            apiVersion: '2024-06-20',
            typescript: true,
            maxNetworkRetries: 1,
            timeout: 10000,
            httpClient: STAMHOOFD.environment === 'test'
                ? Stripe.createFetchHttpClient(passthroughFetch)
                : undefined,
        };

        this.stripe = new Stripe(secretKey, { ...options, stripeAccount: this.stripeAccount?.accountId });
        this.stripePlatform = new Stripe(secretKey, options);
    }

    /**
     * Walks the payouts of every active connected account, after the platform walk warmed the
     * shared payment id cache.
     */
    static async syncConnectedPayouts({ secretKey, start, end, force, cache, accountIds }: { secretKey: string; start: Date; end?: Date; force?: boolean; cache?: StripePaymentIdCache; accountIds?: string[] | null }): Promise<{ synced: number; skipped: number; failed: number }> {
        const sharedCache = cache ?? new Map<string, string>();
        const totals = { synced: 0, skipped: 0, failed: 0 };

        let query = StripeAccount.select().where('status', 'active');
        if (accountIds && accountIds.length > 0) {
            query = query.where('id', accountIds);
        }
        const accounts = await query.fetch();

        for (const account of accounts) {
            try {
                const sync = new StripePayoutSync({ secretKey, stripeAccount: account, cache: sharedCache });
                const result = await sync.syncPayouts({ start, end, force });
                totals.synced += result.synced;
                totals.skipped += result.skipped;
                totals.failed += result.failed;
            } catch (e) {
                console.error('Failed to sync payouts of Stripe account ' + account.accountId, e);
                totals.failed += 1;

                Email.sendWebmaster({
                    subject: 'Synchroniseren Stripe uitbetalingen van account ' + account.accountId + ' mislukt',
                    html: 'Synchroniseren van de Stripe uitbetalingen van account ' + account.accountId + ' is mislukt. <br><br> ' + (e as Error).toString(),
                });
            }
        }

        return totals;
    }

    /**
     * Sync all paid payouts that arrived in the window. A failing payout is marked, emailed and
     * skipped so the other payouts still sync; the summary tells the caller how bad it was.
     */
    async syncPayouts({ start, end, force = false }: { start: Date; end?: Date; force?: boolean }): Promise<{ synced: number; skipped: number; failed: number }> {
        const result = { synced: 0, skipped: 0, failed: 0 };

        // Fail once up front when no organization can own these payouts, instead of once per payout
        // inside the per-payout error boundary
        await this.#getOrganizationId();

        for await (const payout of this.stripe.payouts.list({
            status: 'paid',
            arrival_date: {
                gte: Math.floor(start.getTime() / 1000),
                ...(end ? { lte: Math.floor(end.getTime() / 1000) } : {}),
            },
            limit: 100,
        })) {
            try {
                const { skipped } = await this.syncPayout(payout, { force });
                if (skipped) {
                    result.skipped += 1;
                } else {
                    result.synced += 1;
                }
            } catch (e) {
                console.error('Failed to sync Stripe payout ' + payout.id, e);
                result.failed += 1;

                Email.sendWebmaster({
                    subject: 'Synchroniseren Stripe uitbetaling ' + payout.id + ' mislukt',
                    html: 'Synchroniseren van Stripe uitbetaling ' + payout.id + (this.stripeAccount ? (' van account ' + this.stripeAccount.accountId) : '') + ' is mislukt. <br><br> ' + (e as Error).toString(),
                });
            }
        }

        return result;
    }

    #organizationId: string | null = null;

    /**
     * The organization that owns the walked account: the connected account's organization, or the
     * platform membership organization for our own platform account (resolved once per instance).
     */
    async #getOrganizationId(): Promise<string> {
        this.#organizationId ??= this.stripeAccount?.organizationId ?? await SettlementService.getPlatformOrganizationId();
        return this.#organizationId;
    }

    async syncPayout(payout: Stripe.Payout, { force = false }: { force?: boolean } = {}): Promise<{ settlement: Settlement; skipped: boolean }> {
        return await SettlementService.lock(PaymentProvider.Stripe, payout.id, async () => {
            const settlement = await SettlementService.upsertSettlement({
                provider: PaymentProvider.Stripe,
                externalId: payout.id,
                stripeAccountId: this.stripeAccount?.id ?? null,
                organizationId: await this.#getOrganizationId(),
                reference: payout.statement_descriptor ?? '',
                amount: payout.amount * 100,
                currency: payout.currency?.toUpperCase() ?? 'EUR',
                status: getSettlementStatus(payout.status),
                settledAt: new Date(payout.arrival_date * 1000),
            });

            if (settlement.syncedAt && !force) {
                return { settlement, skipped: true };
            }

            try {
                await this.#walkPayout(payout, settlement);
            } catch (e) {
                await SettlementService.markSyncFailed(settlement);
                throw e;
            }

            return { settlement, skipped: false };
        });
    }

    async #walkPayout(payout: Stripe.Payout, settlement: Settlement) {
        const reported = new ReportedRows();
        let transactionCount = 0;

        for await (const transaction of this.stripe.balanceTransactions.list({
            payout: payout.id,
            limit: 100,
            expand: this.stripeAccount
                ? ['data.source', 'data.source.application_fee', 'data.source.application_fee.originating_transaction', 'data.source.charge']
                : ['data.source', 'data.source.originating_transaction', 'data.source.charge'],
        })) {
            transactionCount += 1;
            await this.#handleTransaction(transaction, settlement, reported);
        }

        await SettlementService.sweepSettlement(settlement, reported);
        await SettlementService.finishSync(settlement, { transactionCount });
    }

    async #handleTransaction(transaction: Stripe.BalanceTransaction, settlement: Settlement, reported: ReportedRows) {
        const occurredAt = new Date(transaction.created * 1000);

        // A plain string switch: the pinned SDK's type union misses some real-world types
        // (e.g. network_cost)
        switch (transaction.type as string) {
            case 'charge':
            case 'payment': {
                const payment = await this.#resolvePayment(transaction);
                reported.paymentLine(await SettlementService.upsertPaymentLine(settlement, {
                    paymentId: payment.id,
                    amount: transaction.amount * 100,
                    externalId: transaction.id,
                    occurredAt,
                }));
                await this.#storeProviderFeeDetails(transaction, settlement, reported, { paymentId: payment.id });
                await SettlementService.updateLegacySettlementReference(payment);
                return;
            }

            case 'refund':
            case 'payment_refund':
            case 'payment_failure_refund':
            case 'refund_failure': {
                // The failure types are SEPA debit failures after settling: locally a Chargeback
                // payment, linked the same way as a refund
                const payment = await this.#resolveReversingPayment(transaction);
                reported.paymentLine(await SettlementService.upsertPaymentLine(settlement, {
                    paymentId: payment.id,
                    amount: transaction.amount * 100,
                    externalId: transaction.id,
                    occurredAt,
                }));
                await this.#storeProviderFeeDetails(transaction, settlement, reported, { paymentId: payment.id });
                await SettlementService.updateLegacySettlementReference(payment);
                return;
            }

            case 'application_fee': {
                // The fee's two Received rows, now linked to the payout that contains them
                reported.charges(await this.feeSync.syncFeeTransaction(transaction, { settlementId: settlement.id }));
                await this.#storeProviderFeeDetails(transaction, settlement, reported, { paymentId: null });
                return;
            }

            case 'application_fee_refund': {
                const source = transaction.source as Stripe.FeeRefund;
                const applicationFeeId = typeof source.fee === 'string' ? source.fee : source.fee.id;

                const charge = await SettlementService.upsertCharge({
                    type: SettlementChargeType.ApplicationFeeRefund,
                    externalId: source.id,
                    amount: transaction.amount * 100,
                    settlementId: settlement.id,
                    applicationFeeId,
                    description: transaction.description ?? '',
                    occurredAt,
                });
                reported.charge(charge);
                await this.#storeProviderFeeDetails(transaction, settlement, reported, { paymentId: null });
                return;
            }

            case 'transfer':
            case 'transfer_cancel':
            case 'transfer_failure':
            case 'transfer_refund': {
                const charge = await SettlementService.upsertCharge({
                    type: transaction.type === 'transfer' ? SettlementChargeType.Transfer : SettlementChargeType.TransferReversal,
                    externalId: transaction.id,
                    amount: transaction.amount * 100,
                    settlementId: settlement.id,
                    description: transaction.description ?? '',
                    occurredAt,
                });
                reported.charge(charge);
                await this.#storeProviderFeeDetails(transaction, settlement, reported, { paymentId: null });
                return;
            }

            case 'stripe_fee':
            case 'network_cost': {
                const charge = await SettlementService.upsertCharge({
                    type: SettlementChargeType.ProviderAccountFee,
                    externalId: transaction.id,
                    amount: transaction.amount * 100,
                    settlementId: settlement.id,
                    organizationId: settlement.organizationId,
                    providerInvoiceId: getStripeInvoiceId(occurredAt),
                    description: transaction.description ?? '',
                    occurredAt,
                });
                reported.charge(charge);
                return;
            }

            case 'reserve_transaction': {
                const charge = await SettlementService.upsertCharge({
                    type: SettlementChargeType.Reserve,
                    externalId: transaction.id,
                    amount: transaction.amount * 100,
                    settlementId: settlement.id,
                    description: transaction.description ?? '',
                    occurredAt,
                });
                reported.charge(charge);
                return;
            }

            case 'adjustment': {
                const paymentId = await this.#tryResolveAdjustmentPayment(transaction);
                const charge = await SettlementService.upsertCharge({
                    type: SettlementChargeType.Adjustment,
                    externalId: transaction.id,
                    amount: transaction.amount * 100,
                    settlementId: settlement.id,
                    // Unresolvable stays undefined: a re-sync may not clear an earlier stored link
                    ...(paymentId ? { paymentId } : {}),
                    description: transaction.description ?? '',
                    occurredAt,
                });
                reported.charge(charge);
                await this.#storeProviderFeeDetails(transaction, settlement, reported, { paymentId });
                return;
            }

            case 'payout':
                // The payout transaction is the payout itself
                return;

            default:
                throw new SimpleError({
                    code: 'unknown_balance_transaction_type',
                    message: 'Unknown balance transaction type ' + transaction.type + ' for transaction ' + transaction.id,
                });
        }
    }

    /**
     * The provider's own fees, deducted inside the transaction. The amounts always come from the
     * balance transaction itself.
     */
    async #storeProviderFeeDetails(transaction: Stripe.BalanceTransaction, settlement: Settlement, reported: ReportedRows, { paymentId }: { paymentId: string | null }) {
        const occurredAt = new Date(transaction.created * 1000);

        for (const [index, detail] of (transaction.fee_details ?? []).entries()) {
            if (detail.amount === 0) {
                continue;
            }

            if (detail.type === 'application_fee') {
                await this.#storeApplicationFeeDeduction(transaction, detail, settlement, reported, { paymentId });
                continue;
            }

            const charge = await SettlementService.upsertCharge({
                type: getFeeDetailType(detail, transaction),
                externalId: transaction.id + ':fee:' + index,
                amount: -detail.amount * 100,
                settlementId: settlement.id,
                paymentId,
                organizationId: settlement.organizationId,
                stripeAccountId: this.stripeAccount?.id ?? null,
                providerInvoiceId: getStripeInvoiceId(occurredAt),
                description: detail.description ?? '',
                occurredAt,
            });
            reported.charge(charge);
        }
    }

    /**
     * On the connected account the application fee is not a separate transaction: it sits inside
     * the payment's fee_details, and the fee id comes from the charge's application_fee. The two
     * negative deduction rows mirror the Received rows of the platform payout, so per
     * applicationFeeId both sides of one kind sum to zero.
     */
    async #storeApplicationFeeDeduction(transaction: Stripe.BalanceTransaction, detail: Stripe.BalanceTransaction.FeeDetail, settlement: Settlement, reported: ReportedRows, { paymentId }: { paymentId: string | null }) {
        if (!this.stripeAccount) {
            throw new SimpleError({
                code: 'unexpected_application_fee_detail',
                message: 'Transaction ' + transaction.id + ' on the platform account has an application_fee fee detail',
            });
        }

        if (detail.amount < 0) {
            // A refunded fee inside an organization payout walk: give it its own mirrored type
            // first instead of writing wrong rows
            throw new SimpleError({
                code: 'negative_application_fee_detail',
                message: 'Transaction ' + transaction.id + ' has a negative application_fee fee detail',
            });
        }

        const source = transaction.source;
        if (!source || typeof source === 'string' || source.object !== 'charge') {
            throw new SimpleError({
                code: 'missing_charge',
                message: 'Transaction ' + transaction.id + ' with an application fee has no expanded charge source',
            });
        }

        const applicationFee = source.application_fee;
        if (!applicationFee || typeof applicationFee === 'string') {
            throw new SimpleError({
                code: 'missing_application_fee',
                message: 'Charge ' + source.id + ' of transaction ' + transaction.id + ' has no expanded application fee',
            });
        }

        // Reuse the platform-side split verbatim, so both sides of the fee (and its serviceFee
        // metadata errors) can never diverge
        const details = ApplicationFeeDetails.fromStripe({
            source: applicationFee,
            amount: detail.amount,
            created: transaction.created,
        });

        const occurredAt = new Date(transaction.created * 1000);

        for (const [type, amount] of [
            [SettlementChargeType.ApplicationFeeService, details.serviceFee],
            [SettlementChargeType.ApplicationFeeTransfer, details.transferFee],
        ] as const) {
            if (amount === 0) {
                continue;
            }

            const charge = await SettlementService.upsertCharge({
                type,
                externalId: applicationFee.id + ':' + type,
                amount: -amount,
                settlementId: settlement.id,
                applicationFeeId: applicationFee.id,
                paymentId,
                organizationId: this.stripeAccount.organizationId,
                stripeAccountId: this.stripeAccount.id,
                occurredAt,
            });
            reported.charge(charge);
        }
    }

    async #resolvePayment(transaction: Stripe.BalanceTransaction): Promise<Payment> {
        const source = transaction.source;
        if (!source || typeof source === 'string' || source.object !== 'charge') {
            throw new SimpleError({
                code: 'missing_charge',
                message: 'Balance transaction ' + transaction.id + ' has no expanded charge source',
            });
        }

        const paymentId = await resolveStripePaymentId(source, {
            stripePlatform: this.stripePlatform,
            cache: this.cache,
        });

        if (!paymentId) {
            throw new SimpleError({
                code: 'payment_not_found',
                message: 'No payment found for charge ' + source.id + ' in transaction ' + transaction.id,
            });
        }

        const payment = await Payment.getByID(paymentId);
        if (!payment) {
            throw new SimpleError({
                code: 'payment_not_found',
                message: 'Payment ' + paymentId + ' referenced by charge ' + source.id + ' does not exist',
            });
        }

        this.#assertPaymentScope(payment, source.id);
        return payment;
    }

    /**
     * Charge metadata is writable by the connected account's owner: a walked payment must belong
     * to the walked account, or spoofed metadata could attach another organization's payment.
     */
    #assertPaymentScope(payment: Payment, chargeId: string) {
        if (this.stripeAccount && payment.stripeAccountId !== this.stripeAccount.id) {
            throw new SimpleError({
                code: 'payment_scope_mismatch',
                message: 'Payment ' + payment.id + ' referenced by charge ' + chargeId + ' does not belong to Stripe account ' + this.stripeAccount.accountId,
            });
        }
    }

    /**
     * Stripe's refund transaction points at the original charge; locally the refund is its own
     * Payment linked through reversingPaymentId, matched on amount. No match means someone refunded
     * outside Stamhoofd: fix the data, don't paper over it.
     */
    async #resolveReversingPayment(transaction: Stripe.BalanceTransaction): Promise<Payment> {
        const source = transaction.source;
        if (!source || typeof source === 'string' || source.object !== 'refund') {
            throw new SimpleError({
                code: 'missing_refund',
                message: 'Balance transaction ' + transaction.id + ' has no expanded refund source',
            });
        }

        if (!source.charge) {
            throw new SimpleError({
                code: 'missing_refund_charge',
                message: 'Refund ' + source.id + ' in transaction ' + transaction.id + ' has no charge',
            });
        }

        const charge = await this.#getCharge(source.charge, transaction);
        const originalPaymentId = await resolveStripePaymentId(charge, {
            stripePlatform: this.stripePlatform,
            cache: this.cache,
        });

        if (!originalPaymentId) {
            throw new SimpleError({
                code: 'payment_not_found',
                message: 'No payment found for refunded charge ' + charge.id + ' in transaction ' + transaction.id,
            });
        }

        let candidates = await Payment.select()
            .where('reversingPaymentId', originalPaymentId)
            .where('price', transaction.amount * 100)
            .fetch();

        if (candidates.length > 1) {
            // Two refunds of the same amount are interchangeable (same original payment, same
            // price): drop the ones already matched to a different provider transaction, then pair
            // deterministically so re-syncs keep the same pairing
            const lines = await PaymentSettlement.select()
                .where('paymentId', candidates.map(c => c.id))
                .fetch();
            const claimed = new Set(lines.filter(l => l.externalId !== transaction.id).map(l => l.paymentId));
            candidates = candidates
                .filter(c => !claimed.has(c.id))
                .sort((a, b) => (a.createdAt.getTime() - b.createdAt.getTime()) || a.id.localeCompare(b.id))
                .slice(0, 1);
        }

        if (candidates.length !== 1) {
            throw new SimpleError({
                code: 'reversing_payment_not_found',
                message: 'Found ' + candidates.length + ' reversing payments for payment ' + originalPaymentId + ' with amount ' + (transaction.amount * 100) + ' (transaction ' + transaction.id + ')',
            });
        }

        this.#assertPaymentScope(candidates[0], charge.id);
        return candidates[0];
    }

    async #tryResolveAdjustmentPayment(transaction: Stripe.BalanceTransaction): Promise<string | null> {
        const source = transaction.source;
        if (!source || typeof source === 'string') {
            return null;
        }

        const charge = (source as { charge?: string | Stripe.Charge }).charge;
        if (!charge) {
            return null;
        }

        try {
            return await resolveStripePaymentId(await this.#getCharge(charge, transaction), {
                stripePlatform: this.stripePlatform,
                cache: this.cache,
            });
        } catch (e) {
            // A charge that no longer exists is "not resolvable"; transient errors must still fail
            // the payout
            if (e instanceof SimpleError && e.code === 'charge_not_found') {
                return null;
            }
            throw e;
        }
    }

    /**
     * Stripe caps `expand` at 4 paths, so a nested object can still come back as an id: fetch it
     * explicitly then (cached per run).
     */
    async #getCharge(charge: string | Stripe.Charge, transaction: Stripe.BalanceTransaction): Promise<Stripe.Charge> {
        if (typeof charge !== 'string') {
            return charge;
        }

        const cached = this.fetchedCharges.get(charge);
        if (cached) {
            return cached;
        }

        try {
            const fetched = await this.stripe.charges.retrieve(charge);
            this.fetchedCharges.set(charge, fetched);
            return fetched;
        } catch (e) {
            if ((e as { statusCode?: number }).statusCode === 404) {
                throw new SimpleError({
                    code: 'charge_not_found',
                    message: 'Charge ' + charge + ' of transaction ' + transaction.id + ' does not exist',
                });
            }
            throw e;
        }
    }
}

function getSettlementStatus(status: string): SettlementStatus {
    switch (status) {
        case 'paid': return SettlementStatus.Paid;
        case 'pending':
        case 'in_transit': return SettlementStatus.Pending;
        case 'failed': return SettlementStatus.Failed;
        case 'canceled': return SettlementStatus.Canceled;
        default:
            throw new SimpleError({
                code: 'unknown_payout_status',
                message: 'Unknown payout status ' + status,
            });
    }
}

/**
 * Stripe has no invoice id in the API, so the derived monthly id groups fee rows per invoice
 * document.
 */
function getStripeInvoiceId(occurredAt: Date): string {
    return 'stripe-' + occurredAt.getFullYear() + '-' + (occurredAt.getMonth() + 1).toString().padStart(2, '0');
}

function getFeeDetailType(detail: Stripe.BalanceTransaction.FeeDetail, transaction: Stripe.BalanceTransaction): SettlementChargeType {
    switch (detail.type) {
        case 'stripe_fee': return SettlementChargeType.ProviderTransactionFee;
        case 'tax': return SettlementChargeType.Tax;
        default:
            throw new SimpleError({
                code: 'unknown_fee_detail_type',
                message: 'Unknown fee detail type ' + detail.type + ' on transaction ' + transaction.id,
            });
    }
}
