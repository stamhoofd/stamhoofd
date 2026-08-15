import { SimpleError } from '@simonbackx/simple-errors';
import type { Payment } from '@stamhoofd/models';
import { BalanceItemPayment, Order, Platform } from '@stamhoofd/models';
import { Payment as PaymentModel } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import type { AbortSignal } from '@stamhoofd/queues';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL } from '@stamhoofd/sql';
import type { PaymentProvider } from '@stamhoofd/structures';
import { PaymentMethod, SettlementReference } from '@stamhoofd/structures';
import type { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import type { SettlementStatus } from '@stamhoofd/structures/settlements/SettlementStatus.js';
import { Formatter } from '@stamhoofd/utility';

export type SettlementData = {
    provider: PaymentProvider;
    externalId: string;
    stripeAccountId?: string | null;
    organizationId: string;
    reference?: string;
    amount: number;
    currency?: string;
    status?: SettlementStatus;
    settledAt: Date;
};

export type PaymentLineData = {
    paymentId: string;
    amount: number;

    /**
     * NULL for a line derived from application fees: it has no provider transaction behind it.
     */
    externalId: string | null;
    occurredAt: Date;
};

export type ChargeData = {
    type: SettlementChargeType;
    externalId: string;
    amount: number;

    /**
     * The charged organization: always the one of the payout it is deducted from, and of the
     * payment it relates to.
     */
    organizationId: string;

    settlementId?: string | null;
    applicationFeeId?: string | null;
    paymentId?: string | null;
    stripeAccountId?: string | null;
    providerInvoiceId?: string | null;
    description?: string;
    occurredAt: Date;
};

/**
 * Rows updated per statement when a whole month of charges is stamped at once.
 */
const CHARGE_UPDATE_BATCH_SIZE = 500;

/**
 * Fees read per batch when a whole organization's fees are walked.
 */
const FEE_BATCH_SIZE = 500;

/**
 * All writes to the settlements tables go through this service. Every write is an upsert on the
 * deterministic unique key of its table, so re-running a sync can never duplicate rows.
 */
export class SettlementService {
    /**
     * Serializes syncs of the same settlement, so cron and manual backfill can't race. In-process
     * only: across multiple API instances the tables' unique keys are the real guard, so a
     * concurrent sync surfaces as a duplicate-key error and is retryable.
     *
     * Interrupting a walk is opt-in: the caller's signal governs the whole sync (so it stops as
     * one, and every caller in it recognizes the abort), and a caller without one walks to the end.
     */
    static lock<T>(provider: PaymentProvider, externalId: string, handler: (abort: AbortSignal) => Promise<T>, { abort }: { abort?: AbortSignal } = {}): Promise<T> {
        return QueueHandler.schedule('settlement-sync-' + provider + '-' + externalId, async (o) => {
            const signal = abort ?? o.abort;

            // Waiting behind another settlement may have taken a while: don't start a walk that is
            // interrupted at its first step anyway
            signal.throwIfAborted();

            return await handler(signal);
        });
    }

    /**
     * Month bucket of a charge, in server-local time: the same boundaries as
     * getMonthUnixStartEnd, which drive the monthly invoice grouping.
     */
    static getPeriodStart(date: Date): Date {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    /**
     * The same month bucket as getPeriodStart, as a 'YYYY-MM' key.
     */
    static getPeriodKey(date: Date): string {
        return date.getFullYear() + '-' + (date.getMonth() + 1).toString().padStart(2, '0');
    }

    /**
     * The same month bucket as getPeriodStart, as unix second bounds (inclusive end, one second
     * before the next month).
     */
    static getMonthUnixStartEnd(date: Date) {
        const start = Math.floor((new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime()) / 1000);
        const end = Math.ceil((new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0).getTime() - 1000) / 1000);
        return { start, end };
    }

    /**
     * Every settlement belongs to an organization. The platform's own provider accounts (the
     * platform Stripe account, the platform Mollie token) belong to the platform membership
     * organization: without one configured, platform payouts cannot be stored.
     */
    static async getPlatformOrganizationId(): Promise<string> {
        const membershipOrganizationId = (await Platform.getShared()).membershipOrganizationId;
        if (!membershipOrganizationId) {
            throw new SimpleError({
                code: 'missing_membership_organization',
                message: 'Platform has no membership organization configured, so platform payouts cannot be attributed to an organization',
            });
        }
        return membershipOrganizationId;
    }

    /**
     * Upsert on (provider, externalId). Never touches syncedAt/syncFailureCount: those belong to
     * finishSync/markSyncFailed.
     */
    static async upsertSettlement(data: SettlementData): Promise<Settlement> {
        const settlement = await Settlement.select()
            .where('provider', data.provider)
            .where('externalId', data.externalId)
            .first(false) ?? new Settlement();

        settlement.provider = data.provider;
        settlement.externalId = data.externalId;
        settlement.organizationId = data.organizationId;
        settlement.amount = data.amount;
        settlement.settledAt = data.settledAt;

        if (data.stripeAccountId !== undefined) {
            settlement.stripeAccountId = data.stripeAccountId;
        }
        if (data.reference !== undefined) {
            settlement.reference = data.reference;
        }
        if (data.currency !== undefined) {
            settlement.currency = data.currency;
        }
        if (data.status !== undefined) {
            settlement.status = data.status;
        }

        await settlement.save();
        return settlement;
    }

    /**
     * Upsert on (settlementId, externalId): one payment can be part of multiple settlements, but a
     * provider transaction appears in a settlement only once. A derived fee line has no provider
     * transaction, so it upserts on (settlementId, paymentId): one per fee payment and payout.
     */
    static async upsertPaymentLine(settlement: Settlement, data: PaymentLineData): Promise<PaymentSettlement> {
        const query = PaymentSettlement.select()
            .where('settlementId', settlement.id)
            .where('externalId', data.externalId);

        if (data.externalId === null) {
            query.where('paymentId', data.paymentId);
        }

        const line = await query.first(false) ?? new PaymentSettlement();

        line.settlementId = settlement.id;
        line.organizationId = settlement.organizationId;
        line.externalId = data.externalId;
        line.paymentId = data.paymentId;
        line.amount = data.amount;
        line.occurredAt = data.occurredAt;

        await line.save();

        // A provider transaction sits in exactly one payout: when it moved, the row it left behind
        // would count the same money twice until that payout happens to be walked again. Derived
        // fee lines are the exception, they legitimately exist per payout
        if (data.externalId !== null) {
            const moved = await PaymentSettlement.select()
                .where('externalId', data.externalId)
                .where('settlementId', '!=', settlement.id)
                .fetch();

            for (const stale of moved) {
                await stale.delete();
            }
            await this.refreshTotalsForIds(Formatter.uniqueArray(moved.map(l => l.settlementId)));
        }

        return line;
    }

    /**
     * Upsert on the globally unique externalId. Fields that are undefined keep their stored value,
     * so the fee sync (which doesn't know the settlement yet) can't unlink a charge the payout sync
     * attached earlier. balanceItemId is deliberately not settable here: only markInvoiced writes
     * it, when the fee is invoiced.
     */
    static async upsertCharge(data: ChargeData): Promise<SettlementCharge> {
        const charge = await SettlementCharge.select()
            .where('externalId', data.externalId)
            .first(false) ?? new SettlementCharge();

        // A charge that moves to another payout leaves the one it came from with cached totals
        // that still count it
        const previousSettlementId = charge.settlementId;

        charge.type = data.type;
        charge.externalId = data.externalId;
        charge.amount = data.amount;
        charge.organizationId = data.organizationId;
        charge.occurredAt = data.occurredAt;

        if (data.settlementId !== undefined) {
            charge.settlementId = data.settlementId;
        }
        if (data.applicationFeeId !== undefined) {
            charge.applicationFeeId = data.applicationFeeId;
        }
        if (data.paymentId !== undefined) {
            charge.paymentId = data.paymentId;
        }
        if (data.stripeAccountId !== undefined) {
            charge.stripeAccountId = data.stripeAccountId;
        }
        if (data.providerInvoiceId !== undefined) {
            charge.providerInvoiceId = data.providerInvoiceId;
        }
        if (data.description !== undefined) {
            charge.description = data.description;
        }
        await charge.save();

        if (previousSettlementId && previousSettlementId !== charge.settlementId) {
            await this.refreshTotalsForIds([previousSettlementId]);
        }

        return charge;
    }

    /**
     * Stamps which invoice bills a charge to the charged party. Kept here so all
     * settlement_charges writes stay in this service; ApplicationFeeService decides when.
     */
    static async setChargeProviderInvoiceId(settlementChargeId: string, providerInvoiceId: string | null) {
        await this.setChargeProviderInvoiceIds([settlementChargeId], providerInvoiceId);
    }

    /**
     * One invoice can bill a whole month of fees, so the charges are stamped in one statement per
     * batch instead of loading and saving every row.
     */
    static async setChargeProviderInvoiceIds(settlementChargeIds: string[], providerInvoiceId: string | null) {
        for (let offset = 0; offset < settlementChargeIds.length; offset += CHARGE_UPDATE_BATCH_SIZE) {
            const batch = settlementChargeIds.slice(offset, offset + CHARGE_UPDATE_BATCH_SIZE);
            await SQL.update(SettlementCharge.table)
                .set('providerInvoiceId', providerInvoiceId)
                .where('id', batch)
                .update();
        }
    }

    /**
     * Recomputes the cached reconciliation columns from the stored rows: `unexplainedAmount` should
     * be 0 — a non-zero value is a real question to answer — and `pendingFees` holds what is
     * received but not invoiced yet, which takes up to a month and only becomes a problem when it
     * stays non-zero too long. Fees the invoicer can never bill land in `uncollectibleFees`
     * instead: they explain their part of the payout, but waiting for them to be invoiced is
     * waiting forever.
     *
     * Every write that changes what a payout holds ends here, or the export and the problem report
     * keep reading numbers from the last sync.
     */
    static async refreshTotals(settlement: Settlement): Promise<Settlement> {
        await this.applyTotals(settlement);
        await settlement.save();
        return settlement;
    }

    /**
     * The recomputation itself, without saving: callers that write more of the settlement in the
     * same breath save once.
     */
    private static async applyTotals(settlement: Settlement): Promise<void> {
        const paymentSum = await PaymentSettlement.select()
            .where('settlementId', settlement.id)
            .sum(SQL.column('amount')) ?? 0;

        const chargeSum = await SettlementCharge.select()
            .where('settlementId', settlement.id)
            .sum(SQL.column('amount')) ?? 0;

        // Once a fee is invoiced it drops out of this sum and its payment's derived line takes
        // over, so the two never count the same fee twice
        const pendingFees = await ApplicationFee.select()
            .where('settlementId', settlement.id)
            .where('balanceItemId', null)
            .where('payingOrganizationId', '!=', null)
            .where('payingStripeAccountId', '!=', null)
            .sum(SQL.column('amount')) ?? 0;

        // The negation of what the invoicer bills (ApplicationFeeInvoicer#selectBillableFees), so
        // every uninvoiced fee sits in exactly one of the two sums
        const uncollectibleFees = await ApplicationFee.select()
            .where('settlementId', settlement.id)
            .where('balanceItemId', null)
            .where(
                SQL.where('payingOrganizationId', null)
                    .or('payingStripeAccountId', null),
            )
            .sum(SQL.column('amount')) ?? 0;

        settlement.pendingFees = pendingFees;
        settlement.uncollectibleFees = uncollectibleFees;
        settlement.unexplainedAmount = settlement.amount - paymentSum - chargeSum - pendingFees - uncollectibleFees;
    }

    /**
     * The payouts holding application fees this organization paid: after deleting it, they have to
     * recount, because those fees moved from pending to uncollectible.
     */
    static async getApplicationFeeSettlementIdsForPayingOrganization(organizationId: string): Promise<string[]> {
        // An organization has one fee row per payment per type, so they are never all loaded at
        // once just to collect the handful of payouts behind them
        const settlementIds = new Set<string>();

        for await (const fees of ApplicationFee.select()
            .where('payingOrganizationId', organizationId)
            .where('settlementId', '!=', null)
            .limit(FEE_BATCH_SIZE)
            .allBatched()) {
            for (const fee of fees) {
                settlementIds.add(fee.settlementId!);
            }
        }

        return [...settlementIds];
    }

    /**
     * Same for settlements the caller only knows by id.
     */
    static async refreshTotalsForIds(settlementIds: string[]): Promise<void> {
        if (settlementIds.length === 0) {
            return;
        }
        const settlements = await Settlement.select().where('id', settlementIds).fetch();
        for (const settlement of settlements) {
            await this.refreshTotals(settlement);
        }
    }

    /**
     * Marks a complete, error-free sync: caches the reconciliation delta and sets syncedAt.
     */
    static async finishSync(settlement: Settlement, { transactionCount }: { transactionCount: number }): Promise<Settlement> {
        await this.applyTotals(settlement);

        settlement.transactionCount = transactionCount;
        settlement.syncFailureCount = 0;

        const syncedAt = new Date();
        syncedAt.setMilliseconds(0);
        settlement.syncedAt = syncedAt;

        await settlement.save();
        return settlement;
    }

    /**
     * Rebuilds the derived payment lines of an AccountDeductions fee payment: one line per platform
     * payout that contains fees billed by this payment, amount = the sum of those fees. When the
     * total of the lines matches the payment's price, the payment is completely paid out.
     */
    static async updatePaymentSettlementsForApplicationFeePayment(payment: Payment): Promise<void> {
        if (payment.method !== PaymentMethod.AccountDeductions) {
            return;
        }

        const balanceItemPayments = await BalanceItemPayment.select()
            .where('paymentId', payment.id)
            .fetch();

        const fees = balanceItemPayments.length > 0
            ? await ApplicationFee.select()
                    .where('balanceItemId', balanceItemPayments.map(b => b.balanceItemId))
                    .fetch()
            : [];

        const perSettlement = new Map<string, { amount: number; occurredAt: Date }>();
        for (const fee of fees) {
            if (!fee.settlementId) {
                continue;
            }
            const group = perSettlement.get(fee.settlementId);
            if (group) {
                group.amount += fee.amount;
                if (fee.occurredAt > group.occurredAt) {
                    group.occurredAt = fee.occurredAt;
                }
            } else {
                perSettlement.set(fee.settlementId, { amount: fee.amount, occurredAt: fee.occurredAt });
            }
        }

        // Every payout whose stored rows change has to be recomputed: a fee that was pending is now
        // explained by the line instead, and a payout that lost its line has it pending again
        const touchedSettlementIds = new Set<string>(perSettlement.keys());

        const existingLines = await PaymentSettlement.select()
            .where('paymentId', payment.id)
            .fetch();
        for (const line of existingLines) {
            if (line.externalId === null && !perSettlement.has(line.settlementId)) {
                touchedSettlementIds.add(line.settlementId);
                await line.delete();
            }
        }

        if (perSettlement.size > 0) {
            const settlements = await Settlement.select()
                .where('id', [...perSettlement.keys()])
                .fetch();
            for (const settlement of settlements) {
                const group = perSettlement.get(settlement.id)!;
                await this.upsertPaymentLine(settlement, {
                    paymentId: payment.id,
                    amount: group.amount,
                    externalId: null,
                    occurredAt: group.occurredAt,
                });
            }
        }

        await this.refreshTotalsForIds([...touchedSettlementIds]);
    }

    /**
     * Refreshes the derived lines of every fee payment that billed one of these balance items:
     * called after a walk linked or unlinked invoiced fees, so the lines follow the fees.
     */
    static async updatePaymentSettlementsForApplicationFeeBalanceItems(balanceItemIds: string[]): Promise<void> {
        if (balanceItemIds.length === 0) {
            return;
        }

        const balanceItemPayments = await BalanceItemPayment.select()
            .where('balanceItemId', balanceItemIds)
            .fetch();
        const paymentIds = Formatter.uniqueArray(balanceItemPayments.map(b => b.paymentId));
        if (paymentIds.length === 0) {
            return;
        }

        const payments = await PaymentModel.getByIDs(...paymentIds);
        for (const payment of payments) {
            await this.updatePaymentSettlementsForApplicationFeePayment(payment);
        }
    }

    /**
     * A walk that was interrupted halfway (a restart aborted it) stored only part of what the
     * provider reports, so the settlement may not keep claiming it is synced: the next run walks it
     * again. Unlike a failed sync it doesn't count towards the retry cap — nothing is wrong with
     * this settlement.
     */
    static async markSyncInterrupted(settlement: Settlement): Promise<Settlement> {
        settlement.syncedAt = null;
        await settlement.save();
        return settlement;
    }

    /**
     * A failed sync leaves syncedAt NULL: that is the whole error queue.
     */
    static async markSyncFailed(settlement: Settlement): Promise<Settlement> {
        settlement.syncedAt = null;
        settlement.syncFailureCount += 1;
        await settlement.save();
        return settlement;
    }

    /**
     * Dual-write of the legacy payments.settlement JSON blob from the new rows. The blob holds one
     * settlement, so the primary is picked deterministically: largest |amount| line, earliest
     * settledAt as tiebreaker — re-syncs never flip-flop the column.
     */
    static async updateLegacySettlementReference(payment: Payment): Promise<void> {
        const lines = await PaymentSettlement.select()
            .where('paymentId', payment.id)
            .fetch();

        if (lines.length === 0) {
            return;
        }

        const settlements = await Settlement.select()
            .where('id', lines.map(l => l.settlementId))
            .where('organizationId', payment.organizationId)
            .fetch();
        const settlementsById = new Map(settlements.map(s => [s.id, s]));

        // Only payouts of the payment's own organization settle it. None stored yet (e.g. that
        // payout isn't synced) means the blob stays untouched.
        const candidates = lines.filter(line => settlementsById.has(line.settlementId));
        if (candidates.length === 0) {
            return;
        }

        const primary = candidates.sort((a, b) => {
            if (Math.abs(a.amount) !== Math.abs(b.amount)) {
                return Math.abs(b.amount) - Math.abs(a.amount);
            }
            const settledA = settlementsById.get(a.settlementId)!.settledAt.getTime();
            const settledB = settlementsById.get(b.settlementId)!.settledAt.getTime();
            if (settledA !== settledB) {
                return settledA - settledB;
            }
            return (a.externalId ?? '').localeCompare(b.externalId ?? '');
        })[0];

        const settlement = settlementsById.get(primary.settlementId)!;

        payment.settlement = SettlementReference.create({
            id: settlement.externalId,
            reference: settlement.reference,
            settledAt: settlement.settledAt,
            amount: settlement.amount,
            // Nothing writes the deprecated fee field anymore; preserve a historically stored
            // value while the primary settlement doesn't change
            fee: payment.settlement?.id === settlement.externalId ? payment.settlement.fee : 0,
        });
        const saved = await payment.save();

        if (saved) {
            // Mark order as 'updated', or the frontend won't pull in the updates
            const order = await Order.getForPayment(null, payment.id);
            if (order) {
                order.updatedAt = new Date();
                order.forceSaveProperty('updatedAt');
                await order.save();
            }
        }
    }
}
