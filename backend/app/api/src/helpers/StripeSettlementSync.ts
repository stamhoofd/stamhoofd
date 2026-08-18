import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, Payment, StripeAccount } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import type { Settlement } from '@stamhoofd/models/models/Settlement.js';
import type { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import type { AbortSignal } from '@stamhoofd/queues';
import { PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { SettlementStatus } from '@stamhoofd/structures/settlements/SettlementStatus.js';
import Stripe from 'stripe';

import { ApplicationFeeService } from '../services/ApplicationFeeService.js';
import { SettlementService } from '../services/SettlementService.js';
import { ApplicationFeeDetails } from './ApplicationFeeDetails.js';
import { getPaymentIdForStripeCharge } from './getPaymentIdForStripeCharge.js';
import { passthroughFetch } from './passthroughFetch.js';
import { WebmasterReport } from './WebmasterReport.js';

/**
 * Who paid an application fee: normally the organization of the Stripe account it was deducted
 * from, and otherwise the organization our own charge metadata names.
 */
type ApplicationFeePayer = {
    organizationId: string;

    /**
     * NULL when we no longer have the stripe_accounts row the fee was deducted from.
     */
    stripeAccountId: string | null;

    /**
     * Whether our records of this payer are still complete. Only false when its stripe_accounts
     * row is gone, which means its organization was deleted: what can't be resolved anymore is
     * then the consequence of that deletion, not a problem to repair. A deleted account keeps its
     * row, and its organization keeps its payments, so those stay strictly checked.
     */
    intact: boolean;
};

/**
 * Walks paid payouts and stores every balance transaction in them: payments become
 * payment_settlements rows, everything else becomes settlement_charges rows. One walker for both
 * scopes: `stripeAccount === null` walks our own platform account, otherwise the connected
 * account's payouts. The platform instance also ingests application fees before any payout
 * contains them (syncFees).
 *
 * Fail loudly: a transaction that can't be attributed or an unknown transaction type fails the
 * whole payout. The settlement stays unsynced (`syncedAt IS NULL`) and is retried later.
 */
export class StripeSettlementSync {
    private stripe: Stripe;
    private stripePlatform: Stripe;
    private stripeAccount: StripeAccount | null;

    /**
     * Explicitly fetched charges (when an expansion came back as an id), per run.
     */
    private fetchedCharges = new Map<string, Stripe.Charge>();

    /**
     * Stripe accounts already reported as unattributable, so a month of their fees is one problem
     * instead of thousands.
     */
    static #reportedUnattributedAccounts = new Set<string>();

    /**
     * For tests only.
     */
    static resetWarnings() {
        this.#reportedUnattributedAccounts.clear();
    }

    /**
     * A fee we can't fully attribute is stored anyway (it is our income), so it would otherwise
     * only exist as a number nobody looks at: the invoicer skips it, and no payout of the payer
     * links it. Reported once per account, so someone decides whether to repair or write it off.
     */
    static reportUnattributedFee(payingAccountId: string, payer: ApplicationFeePayer | null) {
        if (this.#reportedUnattributedAccounts.has(payingAccountId)) {
            return;
        }
        this.#reportedUnattributedAccounts.add(payingAccountId);

        WebmasterReport.report(
            'Applicatiekosten van Stripe account ' + payingAccountId + ' worden niet aangerekend',
            payer
                ? 'Dat account staat niet meer in onze database. De kosten zijn wel opgeslagen op vereniging ' + payer.organizationId + ', maar worden niet automatisch gefactureerd.'
                : 'Dat account en de vereniging erachter staan niet meer in onze database. De kosten zijn opgeslagen als niet-aanrekenbare inkomsten.',
        );
    }

    constructor({ secretKey, stripeAccount }: { secretKey: string; stripeAccount?: StripeAccount | null }) {
        this.stripeAccount = stripeAccount ?? null;

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
     * Sync all paid payouts that arrived in the window.
     */
    async syncPayouts({ start, end, force = false, abort }: { start: Date; end?: Date; force?: boolean; abort?: AbortSignal }): Promise<{ synced: number; skipped: number; failed: number }> {
        const result = { synced: 0, skipped: 0, failed: 0 };

        // Fail once up front when no organization can own these payouts, instead of once per payout
        // inside the per-payout error boundary
        await this.#getOrganizationId();

        // Not filtered on status: a payout can still flip from paid to failed within five business
        // days, and only re-reading it keeps the stored status true
        for await (const payout of this.stripe.payouts.list({
            arrival_date: {
                gte: Math.floor(start.getTime() / 1000),
                ...(end ? { lte: Math.floor(end.getTime() / 1000) } : {}),
            },
            limit: 100,
        })) {
            abort?.throwIfAborted();

            try {
                const { skipped } = await this.syncPayout(payout, { force, abort });
                if (skipped) {
                    result.skipped += 1;
                } else {
                    result.synced += 1;
                }
            } catch (e) {
                // An interrupted payout is not a failing payout: counting or reporting it would
                // turn every restart into a wave of problems to look into
                abort?.throwIfAborted();

                console.error('Failed to sync Stripe payout ' + payout.id, e);
                result.failed += 1;

                WebmasterReport.report('Synchroniseren Stripe uitbetaling ' + payout.id + (this.stripeAccount ? (' van account ' + this.stripeAccount.accountId) : '') + ' mislukt', e);
            }
        }

        return result;
    }

    #organizationId: string | null = null;

    /**
     * Re-sync one payout by its id, e.g. to retry a settlement that stayed unsynced.
     */
    async syncPayoutById(externalId: string, options: { force?: boolean; abort?: AbortSignal } = {}): Promise<{ settlement: Settlement; skipped: boolean }> {
        const payout = await this.stripe.payouts.retrieve(externalId);
        return await this.syncPayout(payout, options);
    }

    /**
     * Walks all application_fee balance transactions in the window, storing the payer's deduction
     * charges and the application fee rows before any payout contains them; the payout walks fill
     * in the settlement links later. A broken fee doesn't block storing the others, but the walk
     * still fails loudly at the end: a month is only invoiced after a run without errors.
     */
    async syncFees({ start, end, abort }: { start: Date; end: Date; abort?: AbortSignal }) {
        if (this.stripeAccount) {
            throw new SimpleError({
                code: 'invalid_scope',
                message: 'Application fees live on the platform account, not on connected account ' + this.stripeAccount.accountId,
            });
        }

        const errors: unknown[] = [];

        // Storing a fee can link it to a balance item right away (a month the legacy invoicer
        // billed). When it is already paid out, its payout needs the derived line for it
        const settledApplicationFeeBalanceItems = new Set<string>();

        try {
            for await (const transaction of this.stripe.balanceTransactions.list({
                type: 'application_fee',
                created: {
                    gte: Math.floor(start.getTime() / 1000),
                    lte: Math.floor(end.getTime() / 1000),
                },
                expand: ['data.source', 'data.source.originating_transaction'],
                limit: 100,
            })) {
                abort?.throwIfAborted();

                try {
                    await this.#handleApplicationFee(transaction, { settledApplicationFeeBalanceItems });
                } catch (e) {
                    // The month is only invoiced after a walk without errors, so an interrupted
                    // walk has to stop the walk itself instead of joining the errors of its
                    // transactions
                    abort?.throwIfAborted();

                    console.error('Failed to sync application fee transaction ' + transaction.id, e);
                    errors.push(e);
                }
            }
        } catch (e) {
            // The payouts of the fees stored so far still need their derived lines, but failing to
            // update them may not hide what broke the walk
            await SettlementService.updatePaymentSettlementsForApplicationFeeBalanceItems([...settledApplicationFeeBalanceItems]).catch(console.error);
            throw e;
        }

        await SettlementService.updatePaymentSettlementsForApplicationFeeBalanceItems([...settledApplicationFeeBalanceItems]);

        if (errors.length > 0) {
            throw new SimpleError({
                code: 'stripe_fee_sync_failed',
                message: 'Fee sync failed for ' + errors.length + ' transaction(s): ' + errors.map(e => e instanceof Error ? e.message : String(e)).join('; '),
            });
        }
    }

    /**
     * Stores the SettlementCharge for the connected account (costs) and ApplicationFee for the platform account (revenue), related to an application fee in Stripe.
     */
    async #handleApplicationFee(transaction: Stripe.BalanceTransaction, options: {
        settlementId?: string;

        /**
         * Collects the balance items of the invoiced fees stored here, so their fee payments can
         * be updated afterwards. Filled while storing, not from the return value: a fee that is
         * stored before a later one throws still needs its derived line.
         */
        settledApplicationFeeBalanceItems?: Set<string>;
    } = {}): Promise<{ fees: ApplicationFee[]; charges: SettlementCharge[] }> {
        const fee = transaction.source as Stripe.ApplicationFee;
        const payingAccountId = typeof fee.account === 'string' ? fee.account : fee.account.id;

        const originatingTransaction = fee.originating_transaction;
        if (!originatingTransaction || typeof originatingTransaction === 'string') {
            throw new SimpleError({
                code: 'missing_originating_transaction',
                message: 'Application fee ' + fee.id + ' has no expanded originating transaction',
            });
        }
        const originatingCharge = originatingTransaction as Stripe.Charge;
        const details = ApplicationFeeDetails.fromStripe(transaction);
        const resolvedPaymentId = await getPaymentIdForStripeCharge(originatingCharge, {
            stripePlatform: this.stripePlatform,
        });
        const resolvedPayment = (resolvedPaymentId ? await Payment.getByID(resolvedPaymentId) : null) ?? null;

        const payer = await this.#resolveApplicationFeePayer(payingAccountId, originatingCharge, resolvedPayment);
        const paymentId = this.#getApplicationFeePaymentId(fee, payer, { paymentId: resolvedPaymentId, payment: resolvedPayment });

        if (!payer?.stripeAccountId) {
            StripeSettlementSync.reportUnattributedFee(payingAccountId, payer);
        }

        const occurredAt = new Date(transaction.created * 1000);

        const fees: ApplicationFee[] = [];
        const charges: SettlementCharge[] = [];

        // Application fees are charged by the platform organization: it receives them, and bills
        // them to the paying organization
        const receivingOrganizationId = await SettlementService.getPlatformOrganizationId();

        for (const [chargeType, feeType, amount] of [
            [SettlementChargeType.ApplicationFeeService, ApplicationFeeType.Service, details.serviceFee],
            [SettlementChargeType.ApplicationFeeTransfer, ApplicationFeeType.Transfer, details.transferFee],
        ] as const) {
            if (amount === 0) {
                continue;
            }

            const charge = payer
                ? await SettlementService.upsertCharge({
                        type: chargeType,
                        externalId: fee.id + ':' + chargeType,
                        amount: -amount,
                        applicationFeeId: fee.id,

                        // Unresolvable stays undefined: a re-sync may not clear earlier stored links
                        paymentId: paymentId ?? undefined,
                        organizationId: payer.organizationId ?? undefined,
                        stripeAccountId: payer.stripeAccountId ?? undefined,
                        occurredAt,

                        // settlementId (settlement of the paying organization where the costs are deducted): still unknown, will be filled when looping the payouts of the paying organization
                    })
                : null;

            if (charge) {
                charges.push(charge);
            }

            const storedFee = await ApplicationFeeService.upsertFee({
                externalId: fee.id,
                type: feeType,
                amount,
                organizationId: receivingOrganizationId,

                // Unresolvable stays undefined: a re-sync may not clear earlier stored links
                payingOrganizationId: payer?.organizationId ?? undefined,
                payingStripeAccountId: payer?.stripeAccountId ?? undefined,
                payingPaymentId: paymentId ?? undefined,
                settlementChargeId: charge?.id ?? undefined,
                settlementId: options.settlementId,
                occurredAt,
            });
            fees.push(storedFee);

            // An invoiced fee is explained by the derived line of its fee payment instead of by
            // itself, so the payouts it sits in have to rebuild those lines
            if (storedFee.balanceItemId && storedFee.settlementId) {
                options.settledApplicationFeeBalanceItems?.add(storedFee.balanceItemId);
            }
        }

        return { fees, charges };
    }

    /**
     * The organization an application fee was deducted from. Its Stripe account is the first
     * source. A deleted organization takes its stripe_accounts row with it, and accounts deleted
     * before we started keeping deleted ones are gone too; what is left of the payment then still
     * names the organization: our own payment row first, and otherwise the metadata we wrote on the
     * charge. Only a destination charge has an originating transaction, and that charge sits on our
     * platform account, so the connected account could not have changed either.
     *
     * NULL when even that organization no longer exists: the fee is then income without a payer.
     */
    async #resolveApplicationFeePayer(payingAccountId: string, originatingCharge: Stripe.Charge, payment: Payment | null): Promise<ApplicationFeePayer | null> {
        const stripeAccount = await StripeAccount.select().where('accountId', payingAccountId).first(false);
        if (stripeAccount) {
            return {
                organizationId: stripeAccount.organizationId,
                stripeAccountId: stripeAccount.id,
                intact: true,
            };
        }

        if (payment?.organizationId) {
            return { organizationId: payment.organizationId, stripeAccountId: null, intact: false };
        }

        const organizationId = originatingCharge.metadata?.organization;
        if (!organizationId || !await Organization.getByID(organizationId)) {
            return null;
        }

        return { organizationId, stripeAccountId: null, intact: false };
    }

    /**
     * The payer's payment an application fee was charged on. Charge metadata is writable by the
     * connected account's owner: the fee is deducted from this account, so it can only be about a
     * payment of its own organization.
     *
     * A payer whose records are no longer intact keeps whatever still resolves: its payments may
     * have been deleted with its account, so a missing one is expected instead of something to
     * repair.
     */
    #getApplicationFeePaymentId(fee: Stripe.ApplicationFee, payer: ApplicationFeePayer | null, { paymentId, payment }: { paymentId: string | null; payment: Payment | null }): string | null {
        if (!payer) {
            return null;
        }

        if (!paymentId) {
            if (!payer.intact) {
                return null;
            }
            throw new SimpleError({
                code: 'payment_not_found',
                message: 'No payment found for application fee ' + fee.id,
            });
        }

        if (!payment || payment.organizationId !== payer.organizationId) {
            if (!payer.intact) {
                return null;
            }
            throw new SimpleError({
                code: 'payment_scope_mismatch',
                message: 'Payment ' + paymentId + ' of application fee ' + fee.id + ' does not belong to organization ' + payer.organizationId,
            });
        }

        return paymentId;
    }

    /**
     * The organization that owns the walked account: the connected account's organization, or the
     * platform membership organization for our own platform account (resolved once per instance).
     */
    async #getOrganizationId(): Promise<string> {
        this.#organizationId ??= this.stripeAccount?.organizationId ?? await SettlementService.getPlatformOrganizationId();
        return this.#organizationId;
    }

    async syncPayout(payout: Stripe.Payout, { force = false, abort }: { force?: boolean; abort?: AbortSignal } = {}): Promise<{ settlement: Settlement; skipped: boolean }> {
        // All amounts are stored in the same unit: a payout in another currency would be stored as
        // a plausible but wrong number
        if (payout.currency && payout.currency.toUpperCase() !== 'EUR') {
            throw new SimpleError({
                code: 'unsupported_payout_currency',
                message: 'Payout ' + payout.id + ' is in ' + payout.currency + ', only EUR is supported',
            });
        }

        return await SettlementService.lock(PaymentProvider.Stripe, payout.id, async (signal) => {
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

            // Money that never arrived holds no transactions to walk. The status above is still
            // refreshed, so a payout that flips to failed stops claiming it was paid out
            if (payout.status !== 'paid') {
                return { settlement, skipped: true };
            }

            // Stripe only lists the transactions of a payout once it finished reconciling it, and
            // never for manual payouts. Walking anyway would store an empty payout and mark it
            // synced, which no later run would ever revisit
            if (payout.reconciliation_status !== 'completed') {
                if (payout.reconciliation_status === 'not_applicable') {
                    throw new SimpleError({
                        code: 'unsupported_payout',
                        message: 'Stripe does not report the transactions of payout ' + payout.id + ' (' + payout.reconciliation_status + '), which only happens for manual payouts',
                    });
                }
                // Still reconciling at Stripe: it stays unsynced and the next run picks it up
                return { settlement, skipped: true };
            }

            if (settlement.syncedAt && !force) {
                return { settlement, skipped: true };
            }

            try {
                await this.#walkPayout(payout, settlement, signal);
            } catch (e) {
                // A walk that was interrupted stored only part of the payout: it has to be walked
                // again, but it didn't fail
                if (signal.isAborted) {
                    await SettlementService.markSyncInterrupted(settlement);
                } else {
                    await SettlementService.markSyncFailed(settlement);
                }
                throw e;
            }

            return { settlement, skipped: false };
        }, { abort });
    }

    async #walkPayout(payout: Stripe.Payout, settlement: Settlement, abort: AbortSignal) {
        let transactionCount = 0;

        // Keep track of all balance items linked to (settled) application fees that are created or updated.
        // So we can update the settlement status of the associated payments
        const settledApplicationFeeBalanceItems = new Set<string>();

        try {
            for await (const transaction of this.stripe.balanceTransactions.list({
                payout: payout.id,
                limit: 100,
                expand: this.stripeAccount
                    ? ['data.source', 'data.source.application_fee', 'data.source.application_fee.originating_transaction', 'data.source.charge']
                    : ['data.source', 'data.source.originating_transaction', 'data.source.charge'],
            })) {
                abort.throwIfAborted();

                transactionCount += 1;
                await this.#handleTransaction(transaction, settlement, settledApplicationFeeBalanceItems);
            }

            if (transactionCount === 0 && settlement.amount !== 0) {
                throw new SimpleError({
                    code: 'empty_payout',
                    message: 'Payout ' + payout.id + ' of ' + settlement.amount + ' has no balance transactions',
                });
            }
        } catch (e) {
            // The fee payments still follow the fees this walk linked before it broke (a fee may
            // never sit in a payout that has no line for it), but failing to update them may not
            // hide what broke the walk
            await SettlementService.updatePaymentSettlementsForApplicationFeeBalanceItems([...settledApplicationFeeBalanceItems]).catch(console.error);
            throw e;
        }

        await SettlementService.updatePaymentSettlementsForApplicationFeeBalanceItems([...settledApplicationFeeBalanceItems]);
        await SettlementService.finishSync(settlement, { transactionCount });
    }

    async #handleTransaction(transaction: Stripe.BalanceTransaction, settlement: Settlement, settledApplicationFeeBalanceItems: Set<string>) {
        const occurredAt = new Date(transaction.created * 1000);

        switch (transaction.type as string) {
            case 'charge':
            case 'payment': {
                const payment = await this.#resolvePayment(transaction);

                if (!payment || payment.organizationId !== settlement.organizationId) {
                    // Destination charge via the platform
                    await this.#storePaidFeesForTransaction(transaction, settlement, { paymentId: null });
                    return;
                }

                await SettlementService.upsertPaymentLine(settlement, {
                    paymentId: payment.id,
                    amount: transaction.amount * 100,
                    externalId: transaction.id,
                    occurredAt,
                });
                await this.#storePaidFeesForTransaction(transaction, settlement, { paymentId: payment.id });
                await this.#updateTransferFee(transaction, settlement, payment);
                await SettlementService.updateLegacySettlementReference(payment);
                return;
            }

            case 'refund':
            case 'payment_refund':
            case 'payment_failure_refund':
            case 'refund_failure': {
                // payment_failure_refund is a SEPA debit that failed after settling: locally a
                // Chargeback payment, linked the same way as a refund. refund_failure is the
                // opposite: a refund that never reached the customer, so the money comes back and
                // its transaction is positive while the reversing payment stays negative
                const isReturned = transaction.type === 'refund_failure';
                const refunded = await this.#resolveRefundedPayment(transaction);

                if (refunded.organizationId !== settlement.organizationId) {
                    // Destination charge via the platform
                    await this.#storePaidFeesForTransaction(transaction, settlement, { paymentId: null });
                    return;
                }

                const payment = await this.#resolveReversingPayment(transaction, refunded, { negated: isReturned });
                await SettlementService.upsertPaymentLine(settlement, {
                    paymentId: payment.id,
                    amount: transaction.amount * 100,
                    externalId: transaction.id,
                    occurredAt,
                });
                await this.#storePaidFeesForTransaction(transaction, settlement, { paymentId: payment.id });
                await SettlementService.updateLegacySettlementReference(payment);
                return;
            }

            case 'application_fee': {
                // The fee rows, now linked to the platform payout that contains them
                await this.#handleApplicationFee(transaction, { settlementId: settlement.id, settledApplicationFeeBalanceItems });
                await this.#storePaidFeesForTransaction(transaction, settlement, { paymentId: null });
                return;
            }

            case 'application_fee_refund': {
                const source = transaction.source as Stripe.FeeRefund;
                const applicationFeeId = typeof source.fee === 'string' ? source.fee : source.fee.id;

                // We never refund application fees ourselves, so this can only come from the Stripe
                // dashboard. Storing just the charge would leave the fee billed in full to the
                // organization: what to give back is a decision someone has to make first
                throw new SimpleError({
                    code: 'unsupported_application_fee_refund',
                    message: 'Application fee ' + applicationFeeId + ' was refunded in transaction ' + transaction.id + ', which is not billed back to the organization automatically',
                });
            }

            case 'transfer':
            case 'transfer_cancel':
            case 'transfer_failure':
            case 'transfer_refund':
                // The other half of a pass-through: it moves the same gross back out of our
                // balance, so ignoring both keeps the payout explained. We never transfer money
                // ourselves, so a transfer without its charge can only be a real problem, and it
                // surfaces as an unexplained amount
                return;

            case 'stripe_fee':
            case 'network_cost':
            case 'tax_fee': {
                await SettlementService.upsertCharge({
                    type: transaction.type === 'tax_fee' ? SettlementChargeType.Tax : SettlementChargeType.ProviderAccountFee,
                    externalId: transaction.id,
                    amount: transaction.amount * 100,
                    settlementId: settlement.id,
                    organizationId: settlement.organizationId,
                    providerInvoiceId: getStripeInvoiceId(occurredAt),
                    description: transaction.description ?? '',
                    occurredAt,
                });
                return;
            }

            case 'reserve_transaction':
            case 'reserved_funds':
            case 'reserve_hold':
            case 'reserve_release': {
                await SettlementService.upsertCharge({
                    type: SettlementChargeType.Reserve,
                    externalId: transaction.id,
                    amount: transaction.amount * 100,
                    settlementId: settlement.id,
                    organizationId: settlement.organizationId,
                    description: transaction.description ?? '',
                    occurredAt,
                });
                return;
            }

            case 'adjustment':
            case 'payment_reversal': {
                const paymentId = await this.#tryResolveAdjustmentPayment(transaction, settlement);
                await SettlementService.upsertCharge({
                    type: SettlementChargeType.Adjustment,
                    externalId: transaction.id,
                    amount: transaction.amount * 100,
                    settlementId: settlement.id,
                    // Unresolvable stays undefined: a re-sync may not clear an earlier stored link
                    ...(paymentId ? { paymentId } : {}),
                    organizationId: settlement.organizationId,
                    description: transaction.description ?? '',
                    occurredAt,
                });
                await this.#storePaidFeesForTransaction(transaction, settlement, { paymentId });
                return;
            }

            // Money moving in or out of the balance around the payouts themselves: a returned
            // payout, a top-up, or Stripe settling something against the balance. None of them
            // belong to a payment, but they do change what a later payout holds
            case 'payout_failure':
            case 'payout_cancel':
            case 'topup':
            case 'topup_reversal':
            case 'connect_collection_transfer':
            case 'stripe_balance_payment_debit':
            case 'stripe_balance_payment_debit_reversal': {
                await SettlementService.upsertCharge({
                    type: SettlementChargeType.BalanceMovement,
                    externalId: transaction.id,
                    amount: transaction.amount * 100,
                    settlementId: settlement.id,
                    organizationId: settlement.organizationId,
                    description: transaction.description ?? transaction.type,
                    occurredAt,
                });
                await this.#storePaidFeesForTransaction(transaction, settlement, { paymentId: null });
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
     * The fees the walked account paid inside this transaction: the provider's own fees, and on a
     * connected account also the application fee we charged. The amounts always come from the
     * balance transaction itself.
     */
    async #storePaidFeesForTransaction(transaction: Stripe.BalanceTransaction, settlement: Settlement, { paymentId }: { paymentId: string | null }) {
        const occurredAt = new Date(transaction.created * 1000);

        for (const [index, detail] of (transaction.fee_details ?? []).entries()) {
            if (detail.amount === 0) {
                continue;
            }

            if (detail.type === 'application_fee') {
                await this.#storePaidApplicationFeeForTransaction(transaction, detail, settlement, { paymentId });
                continue;
            }

            await SettlementService.upsertCharge({
                type: getFeeDetailType(detail, transaction),
                externalId: transaction.id + ':fee:' + index,
                amount: -detail.amount * 100,
                settlementId: settlement.id,
                // Unresolvable stays undefined: a re-sync may not clear an earlier stored link
                ...(paymentId ? { paymentId } : {}),
                organizationId: settlement.organizationId,
                stripeAccountId: this.stripeAccount?.id ?? null,
                providerInvoiceId: getStripeInvoiceId(occurredAt),
                description: detail.description ?? '',
                occurredAt,
            });
        }
    }

    /**
     * On the connected account the application fee is not a separate transaction: it sits inside
     * the payment's fee_details, and the fee id comes from the charge's application_fee. The two
     * negative deduction rows mirror the application fee rows of the platform side, so per
     * applicationFeeId both sides of one kind sum to zero. This walk fills their settlementId; the
     * rows themselves usually already exist (created by the fee walk).
     */
    async #storePaidApplicationFeeForTransaction(transaction: Stripe.BalanceTransaction, detail: Stripe.BalanceTransaction.FeeDetail, settlement: Settlement, { paymentId }: { paymentId: string | null }) {
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
                // Unresolvable stays undefined: it may not clear the link the fee walk stored
                ...(paymentId ? { paymentId } : {}),
                organizationId: this.stripeAccount.organizationId,
                stripeAccountId: this.stripeAccount.id,
                occurredAt,
            });

            // What the organization pays here is what we receive on the other side. The two are
            // written from different Stripe transactions, so a divergence would silently bill the
            // wrong amount
            const fee = await ApplicationFee.select().where('settlementChargeId', charge.id).first(false);
            if (fee && fee.amount !== -charge.amount) {
                throw new SimpleError({
                    code: 'application_fee_mismatched',
                    message: 'Application fee ' + applicationFee.id + ' is stored as ' + fee.amount + ' but deducted as ' + charge.amount + ' in transaction ' + transaction.id,
                });
            }
        }
    }

    /**
     * The payout-time actual replaces the upfront estimate stored at payment time. A destination
     * charge appears gross in both the organization payout and the platform payout: only the
     * payout of the payment's own account may correct the fee, the same scoping rule as the
     * legacy blob.
     */
    async #updateTransferFee(transaction: Stripe.BalanceTransaction, settlement: Settlement, payment: Payment) {
        if (payment.stripeAccountId !== settlement.stripeAccountId) {
            return;
        }

        // A charge that doesn't cover the payment's full price 1:1 can't attribute its fees to
        // the payment as-is
        if (payment.price !== transaction.amount * 100) {
            return;
        }

        const source = transaction.source;
        if (!source || typeof source === 'string' || source.object !== 'charge') {
            return;
        }

        // What the organization actually paid on this transaction. On a destination charge that is
        // only our application fee; on a direct charge the transaction's fee also holds Stripe's
        // own processing fee, which the application fee detail separates out
        const applicationFeeDetail = (transaction.fee_details ?? []).find(detail => detail.type === 'application_fee');
        const totalFees = applicationFeeDetail
            ? applicationFeeDetail.amount
            : Math.max(transaction.fee, source.application_fee_amount ?? 0);

        payment.transferFee = totalFees * 100 - payment.serviceFeePayout;
        await payment.save();
    }

    async #resolvePayment(transaction: Stripe.BalanceTransaction): Promise<Payment | null> {
        const source = transaction.source;
        if (!source || typeof source === 'string' || source.object !== 'charge') {
            throw new SimpleError({
                code: 'missing_charge',
                message: 'Balance transaction ' + transaction.id + ' has no expanded charge source',
            });
        }

        const paymentId = await getPaymentIdForStripeCharge(source, {
            stripePlatform: this.stripePlatform,
        });

        if (!paymentId) {
            throw new SimpleError({
                code: 'payment_not_found',
                message: 'No payment found for charge ' + source.id + ' in transaction ' + transaction.id,
            });
        }

        const payment = await Payment.getByID(paymentId);
        if (!payment) {
            // Probably deleted

            return null;
            // throw new SimpleError({
            //     code: 'payment_not_found',
            //     message: 'Payment ' + paymentId + ' referenced by charge ' + source.id + ' does not exist',
            // });
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
     * The payment a refund transaction reverses: Stripe's refund points at the original charge.
     */
    async #resolveRefundedPayment(transaction: Stripe.BalanceTransaction): Promise<Payment> {
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
        const originalPaymentId = await getPaymentIdForStripeCharge(charge, {
            stripePlatform: this.stripePlatform,
        });

        if (!originalPaymentId) {
            throw new SimpleError({
                code: 'payment_not_found',
                message: 'No payment found for refunded charge ' + charge.id + ' in transaction ' + transaction.id,
            });
        }

        const payment = await Payment.getByID(originalPaymentId);
        if (!payment) {
            throw new SimpleError({
                code: 'payment_not_found',
                message: 'Payment ' + originalPaymentId + ' referenced by refunded charge ' + charge.id + ' does not exist',
            });
        }

        this.#assertPaymentScope(payment, charge.id);
        return payment;
    }

    /**
     * Locally a refund is its own Payment linked through reversingPaymentId, matched on amount. No
     * match means someone refunded outside Stamhoofd: fix the data, don't paper over it.
     *
     * `negated` matches a transaction that moves the money the other way (a refund that came back)
     * against the same reversing payment.
     */
    async #resolveReversingPayment(transaction: Stripe.BalanceTransaction, refunded: Payment, { negated = false }: { negated?: boolean } = {}): Promise<Payment> {
        let candidates = await Payment.select()
            .where('reversingPaymentId', refunded.id)
            .where('price', (negated ? -transaction.amount : transaction.amount) * 100)
            // A refund that failed locally keeps its payment: it never moved money, so it can't be
            // the one this transaction settles
            .where('status', '!=', PaymentStatus.Failed)
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
                message: 'Found ' + candidates.length + ' reversing payments for payment ' + refunded.id + ' with amount ' + (transaction.amount * 100) + ' (transaction ' + transaction.id + ')',
            });
        }

        this.#assertPaymentScope(candidates[0], refunded.id);
        return candidates[0];
    }

    /**
     * Returns the payment id associated with a dispute, dispute reversal, failed refund.
     *
     * Only when this payout's organization owns that payment: the liability for a dispute on a
     * destination charge lands on our platform balance, while the payment itself belongs to the
     * connected organization. The cost is still stored (it is deducted here), just without a link
     * to another organization's payment.
     */
    async #tryResolveAdjustmentPayment(transaction: Stripe.BalanceTransaction, settlement: Settlement): Promise<string | null> {
        const source = transaction.source;
        if (!source || typeof source === 'string') {
            return null;
        }

        const charge = (source as { charge?: string | Stripe.Charge }).charge;
        if (!charge) {
            return null;
        }

        let paymentId: string | null;
        try {
            paymentId = await getPaymentIdForStripeCharge(await this.#getCharge(charge, transaction), {
                stripePlatform: this.stripePlatform,
            });
        } catch (e) {
            // A charge that no longer exists is "not resolvable"; transient errors must still fail
            // the payout
            if (e instanceof SimpleError && e.code === 'charge_not_found') {
                return null;
            }
            throw e;
        }

        if (!paymentId) {
            return null;
        }

        const payment = await Payment.getByID(paymentId);
        if (!payment || payment.organizationId !== settlement.organizationId) {
            return null;
        }
        return paymentId;
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
    switch (detail.type as string) {
        // payment_method_passthrough_fee: network costs itemized on top of the processing fee
        case 'stripe_fee':
        case 'payment_method_passthrough_fee':
            return SettlementChargeType.ProviderTransactionFee;

        // withheld_tax: tax the provider withholds and remits itself
        case 'tax':
        case 'withheld_tax':
            return SettlementChargeType.Tax;
        default:
            throw new SimpleError({
                code: 'unknown_fee_detail_type',
                message: 'Unknown fee detail type ' + detail.type + ' on transaction ' + transaction.id,
            });
    }
}
