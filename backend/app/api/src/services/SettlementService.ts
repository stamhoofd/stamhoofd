import { SimpleError } from '@simonbackx/simple-errors';
import type { Payment } from '@stamhoofd/models';
import { Order, Platform } from '@stamhoofd/models';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL } from '@stamhoofd/sql';
import type { PaymentProvider } from '@stamhoofd/structures';
import { SettlementReference } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import type { SettlementStatus } from '@stamhoofd/structures/settlements/SettlementStatus.js';

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
    externalId: string;
    occurredAt: Date;
};

export type ChargeData = {
    type: SettlementChargeType;
    externalId: string;
    amount: number;
    settlementId?: string | null;
    applicationFeeId?: string | null;
    paymentId?: string | null;
    organizationId?: string | null;
    stripeAccountId?: string | null;
    providerInvoiceId?: string | null;
    description?: string;
    occurredAt: Date;
};

/**
 * The Received rows are the invoicing source: the sweep never deletes them and upserts never clear
 * their balanceItemId.
 */
const RECEIVED_FEE_TYPES: SettlementChargeType[] = [
    SettlementChargeType.ReceivedApplicationFeeService,
    SettlementChargeType.ReceivedApplicationFeeTransfer,
];

/**
 * Collects which rows the provider still reports in a settlement while a sync walks it. A stored
 * row of the settlement that is not in here after the walk has moved or disappeared at the
 * provider, and gets swept.
 */
export class ReportedRows {
    readonly paymentLineExternalIds = new Set<string>();
    readonly chargeExternalIds = new Set<string>();

    paymentLine(line: PaymentSettlement) {
        this.paymentLineExternalIds.add(line.externalId);
    }

    charge(charge: SettlementCharge) {
        this.chargeExternalIds.add(charge.externalId);
    }

    charges(charges: SettlementCharge[]) {
        for (const charge of charges) {
            this.charge(charge);
        }
    }
}

/**
 * All writes to the settlements tables go through this service. Every write is an upsert on the
 * deterministic unique key of its table, so re-running a sync can never duplicate rows.
 */
export class SettlementService {
    /**
     * Serializes syncs of the same settlement, so cron and manual backfill can't race. In-process
     * only: across multiple API instances the tables' unique keys are the real guard, so a
     * concurrent sync surfaces as a duplicate-key error and is retryable.
     */
    static lock<T>(provider: PaymentProvider, externalId: string, handler: () => Promise<T>): Promise<T> {
        return QueueHandler.schedule('settlement-sync-' + provider + '-' + externalId, handler);
    }

    /**
     * Month bucket of a charge, in server-local time: the same boundaries as
     * StripeInvoicer.getMonthUnixStartEnd, which drive the monthly invoice grouping.
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
     * provider transaction appears in a settlement only once.
     */
    static async upsertPaymentLine(settlement: Settlement, data: PaymentLineData): Promise<PaymentSettlement> {
        const line = await PaymentSettlement.select()
            .where('settlementId', settlement.id)
            .where('externalId', data.externalId)
            .first(false) ?? new PaymentSettlement();

        line.settlementId = settlement.id;
        line.externalId = data.externalId;
        line.paymentId = data.paymentId;
        line.amount = data.amount;
        line.occurredAt = data.occurredAt;

        await line.save();
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

        charge.type = data.type;
        charge.externalId = data.externalId;
        charge.amount = data.amount;
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
        if (data.organizationId !== undefined) {
            charge.organizationId = data.organizationId;
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
        return charge;
    }

    /**
     * Records that the charge was invoiced, and by which balance item. The only writer of
     * balanceItemId: called when the fee is invoiced, or by StripeFeeInvoiceBackfill for months
     * that were already invoiced before these rows existed.
     */
    static async markInvoiced(charge: SettlementCharge, balanceItemId: string) {
        charge.balanceItemId = balanceItemId;
        await charge.save();
    }

    /**
     * After a complete walk of a settlement: remove rows the provider no longer reports in this
     * settlement (a transaction can move to another payout). Rows that only exist because of the
     * payout are deleted; the Received fee rows are only unlinked, because they are the invoicing
     * source and may already carry a balanceItemId.
     */
    static async sweepSettlement(settlement: Settlement, reported: ReportedRows) {
        const lines = await PaymentSettlement.select()
            .where('settlementId', settlement.id)
            .fetch();

        for (const line of lines) {
            if (!reported.paymentLineExternalIds.has(line.externalId)) {
                await line.delete();
            }
        }

        const charges = await SettlementCharge.select()
            .where('settlementId', settlement.id)
            .fetch();

        for (const charge of charges) {
            if (reported.chargeExternalIds.has(charge.externalId)) {
                continue;
            }

            if (RECEIVED_FEE_TYPES.includes(charge.type)) {
                charge.settlementId = null;
                await charge.save();
            } else {
                await charge.delete();
            }
        }
    }

    /**
     * Marks a complete, error-free sync: caches the reconciliation delta and sets syncedAt.
     * `unexplainedAmount` should be 0 — a non-zero value is a real question to answer.
     */
    static async finishSync(settlement: Settlement, { transactionCount }: { transactionCount: number }): Promise<Settlement> {
        const paymentSum = await PaymentSettlement.select()
            .where('settlementId', settlement.id)
            .sum(SQL.column('amount')) ?? 0;

        const chargeSum = await SettlementCharge.select()
            .where('settlementId', settlement.id)
            .sum(SQL.column('amount')) ?? 0;

        settlement.unexplainedAmount = settlement.amount - paymentSum - chargeSum;
        settlement.transactionCount = transactionCount;
        settlement.syncFailureCount = 0;

        const syncedAt = new Date();
        syncedAt.setMilliseconds(0);
        settlement.syncedAt = syncedAt;

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
            .fetch();
        const settlementsById = new Map(settlements.map(s => [s.id, s]));

        // A destination charge sits in two payouts (gross in the organization payout, gross in our
        // platform payout): only the payout of the payment's own account may become the blob, or
        // the organization would see our platform payout. No scoped lines (e.g. the own-account
        // payout isn't synced yet) means the blob stays untouched.
        const candidates = lines.filter(line => settlementsById.get(line.settlementId)!.stripeAccountId === payment.stripeAccountId);
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
            return a.externalId.localeCompare(b.externalId);
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
