import { BalanceItem, BalanceItemPayment, Invoice, Payment } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { SQL } from '@stamhoofd/sql';
import { BalanceItemType, PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { Formatter } from '@stamhoofd/utility';

import { WebmasterReport } from '../helpers/WebmasterReport.js';
import { SettlementService } from './SettlementService.js';

/**
 * Reference prefix of the fee payments the legacy invoicer created, one per (account, month).
 * Only used to detect them: new fee payments use FEE_PAYMENT_REFERENCE_PREFIX.
 */
export const LEGACY_FEE_PAYMENT_REFERENCE_PREFIX = 'stripe-fees-';

export const FEE_PAYMENT_REFERENCE_PREFIX = 'application-fees-';

/**
 * Fees read per batch when a whole invoice is stamped at once.
 */
const FEE_BATCH_SIZE = 500;

export type ApplicationFeeData = {
    externalId: string;
    type: ApplicationFeeType;
    amount: number;

    /**
     * The organization that charged (and receives) the fee.
     */
    organizationId: string;

    payingOrganizationId?: string | null;
    payingStripeAccountId?: string | null;
    payingPaymentId?: string | null;

    settlementChargeId?: string | null;
    settlementId?: string | null;
    occurredAt: Date;
};

/**
 * All writes to application_fees go through this service (the settlement sweep's unlink excepted).
 * Every write is an upsert on the unique (externalId, type) key, so re-running a sync can never
 * duplicate rows.
 *
 * `balanceItemId === null` must always mean "not yet invoiced": upsertFee immediately links fees of
 * months the legacy invoicer already billed (detected by the legacy payment's reference), so the
 * invoicer only ever sees fees that still need billing.
 */
export class ApplicationFeeService {
    /**
     * Emails about a legacy month that can't be linked are sent once per (account, month) per
     * process, not once per fee.
     */
    private static reportedLegacyProblems = new Set<string>();

    /**
     * The legacy fee payment of a (paying account, month), remembered per process: a month has one
     * answer for all of its fees, and a sync walks thousands of them. Only found payments are
     * remembered, so a fee stored before its payment existed still links on the next pass.
     */
    private static legacyFeePayments = new Map<string, Payment[]>();

    /**
     * For tests only.
     */
    static resetWarnings() {
        this.reportedLegacyProblems.clear();
        this.legacyFeePayments.clear();
    }

    /**
     * Upsert on (externalId, type). Fields that are undefined keep their stored value, so the fee
     * walk (which doesn't know our platform payout yet) can't unlink a fee the payout sync attached
     * earlier. balanceItemId is only written through markInvoiced or the inline legacy detection.
     */
    static async upsertFee(data: ApplicationFeeData): Promise<ApplicationFee> {
        const fee = await ApplicationFee.select()
            .where('externalId', data.externalId)
            .where('type', data.type)
            .first(false) ?? new ApplicationFee();

        fee.externalId = data.externalId;
        fee.type = data.type;
        fee.amount = data.amount;
        fee.organizationId = data.organizationId;
        fee.occurredAt = data.occurredAt;

        if (data.settlementId !== undefined) {
            fee.settlementId = data.settlementId;
        }

        if (data.payingPaymentId !== undefined) {
            fee.payingPaymentId = data.payingPaymentId;
        }

        if (data.settlementChargeId !== undefined) {
            fee.settlementChargeId = data.settlementChargeId;
        }

        if (data.payingOrganizationId !== undefined) {
            fee.payingOrganizationId = data.payingOrganizationId;
        }

        if (data.payingStripeAccountId !== undefined) {
            fee.payingStripeAccountId = data.payingStripeAccountId;
        }

        await fee.save();

        if (fee.balanceItemId === null) {
            await this.linkLegacyInvoicedFee(fee);
        }

        return fee;
    }

    /**
     * Records which balance item bills the fee to the payer. Pass the fee payment when the caller
     * already has it, or an explicit null when the balance item is known to have no payment yet
     * (the invoicer stamps before creating the payment): both skip resolving it again.
     */
    static async markInvoiced(fee: ApplicationFee, balanceItemId: string, { payment }: { payment?: Payment | null } = {}) {
        fee.balanceItemId = balanceItemId;
        await fee.save();
        if (payment === null) {
            return;
        }
        await this.stampProviderInvoiceId(fee, { payment });
    }

    /**
     * The fee payments the legacy invoicer created for a (payer, month), matched on their
     * reference. The OR NULL clause covers legacy payments created without a stripeAccountId.
     */
    static async findLegacyFeePayments({ organizationId, payingOrganizationId, payingStripeAccountId, periodStart }: {
        organizationId: string;
        payingOrganizationId: string;
        payingStripeAccountId: string;
        periodStart: Date;
    }): Promise<Payment[]> {
        const reference = LEGACY_FEE_PAYMENT_REFERENCE_PREFIX + Formatter.dateIso(periodStart);
        const key = organizationId + ':' + payingStripeAccountId + ':' + reference;

        const cached = this.legacyFeePayments.get(key);
        if (cached && cached.length > 0) {
            return cached;
        }

        // Prefer matching stripeAccountId
        let payments = await Payment.select()
            .where('organizationId', organizationId)
            .where('payingOrganizationId', payingOrganizationId)
            .where(
                SQL.where('stripeAccountId', payingStripeAccountId),
            )
            .where('reference', reference)
            .where('method', PaymentMethod.AccountDeductions)
            .where('provider', PaymentProvider.Stripe)
            .where('status', PaymentStatus.Succeeded)
            .fetch();

        if (payments.length) {
            this.legacyFeePayments.set(key, payments);
            return payments;
        }

        payments = await Payment.select()
            .where('organizationId', organizationId)
            .where('payingOrganizationId', payingOrganizationId)
            .where(
                SQL.where('stripeAccountId', payingStripeAccountId)
                    .or('stripeAccountId', null),
            )
            .where('reference', reference)
            .where('method', PaymentMethod.AccountDeductions)
            .where('provider', PaymentProvider.Stripe)
            .where('status', PaymentStatus.Succeeded)
            .fetch();

        this.legacyFeePayments.set(key, payments);
        return payments;
    }

    /**
     * Links a fee the legacy invoicer already billed to that month's balance item, the moment the
     * fee row is created: service fees to the month's ServiceFee item, transfer fees to the
     * TransferFee item. A month without a legacy payment is simply not invoiced yet. A legacy month
     * that can't be linked stays unlinked and is emailed: the invoicer's legacy guard prevents it
     * from being billed twice.
     */
    private static async linkLegacyInvoicedFee(fee: ApplicationFee) {
        if (!fee.payingStripeAccountId || !fee.payingOrganizationId) {
            return;
        }

        const periodStart = SettlementService.getPeriodStart(fee.occurredAt);
        const payments = await this.findLegacyFeePayments({
            organizationId: fee.organizationId,
            payingOrganizationId: fee.payingOrganizationId,
            payingStripeAccountId: fee.payingStripeAccountId,
            periodStart,
        });

        if (payments.length === 0) {
            return;
        }

        const problem = (reason: string) => {
            const key = fee.payingStripeAccountId + ':' + SettlementService.getPeriodKey(periodStart);
            if (this.reportedLegacyProblems.has(key)) {
                return;
            }
            this.reportedLegacyProblems.add(key);
            console.error('Legacy fee linking failed for ' + key + ': ' + reason);
            WebmasterReport.report(
                'Applicatiekosten van account ' + fee.payingStripeAccountId + ' voor ' + SettlementService.getPeriodKey(periodStart) + ' koppelen aan oude facturatie mislukt',
                'Ze worden niet opnieuw aangerekend. ' + reason,
            );
        };

        if (payments.length > 1) {
            problem('Found ' + payments.length + ' legacy fee payments for the same month');
            return;
        }

        const payment = payments[0];
        const balanceItem = await this.findFeeBalanceItem(payment, fee.type);
        if (!balanceItem) {
            problem('The legacy fee payment ' + payment.id + ' has no ' + fee.type + ' balance item');
            return;
        }

        await this.markInvoiced(fee, balanceItem.id, { payment });
    }

    private static async findFeeBalanceItem(payment: Payment, type: ApplicationFeeType): Promise<BalanceItem | null> {
        const balanceItemPayments = await BalanceItemPayment.select()
            .where('paymentId', payment.id)
            .fetch();
        if (balanceItemPayments.length === 0) {
            return null;
        }
        const balanceItems = await BalanceItem.select()
            .where('id', balanceItemPayments.map(b => b.balanceItemId))
            .fetch();
        const balanceItemType = type === ApplicationFeeType.Service ? BalanceItemType.ServiceFee : BalanceItemType.TransferFee;

        // In legacy migrations, the type has been set to 'Other' - fallback to that (contains both service fees and transfer fees in one balance item)
        return balanceItems.find(item => item.type === balanceItemType) ?? (balanceItems.length === 1 ? balanceItems.find(item => item.type === BalanceItemType.Other) : null) ?? null;
    }

    /**
     * Stamps the Stamhoofd invoice number that bills this fee on the payer's deduction charge, so
     * the payer can link the cost in their settlement export to our invoice. No invoice (yet) means
     * no stamp: stampInvoicedPayments runs when the invoice is created later.
     */
    private static async stampProviderInvoiceId(fee: ApplicationFee, { payment }: { payment?: Payment } = {}) {
        if (!fee.settlementChargeId) {
            return;
        }

        if (!payment) {
            if (!fee.balanceItemId) {
                return;
            }
            const balanceItemPayment = await BalanceItemPayment.select()
                .where('balanceItemId', fee.balanceItemId)
                .first(false);
            if (!balanceItemPayment) {
                return;
            }
            payment = await Payment.getByID(balanceItemPayment.paymentId) ?? undefined;
        }

        if (!payment?.invoiceId) {
            return;
        }

        const invoice = await Invoice.getByID(payment.invoiceId);
        if (!invoice?.number) {
            return;
        }

        await SettlementService.setChargeProviderInvoiceId(fee.settlementChargeId, invoice.number);
    }

    /**
     * Called when an invoice for these payments is created (with the invoice) or deleted (with
     * null): stamps or clears the invoice number on the deduction charges of every application fee
     * the payments billed. A no-op for invoices without fee payments.
     */
    static async stampInvoicedPayments(payments: Payment[], invoice: Invoice | null) {
        if (payments.length === 0) {
            return;
        }

        const balanceItemPayments = await BalanceItemPayment.select()
            .where('paymentId', payments.map(p => p.id))
            .fetch();
        if (balanceItemPayments.length === 0) {
            return;
        }

        // An invoice can bill a whole month of fees, so the charges are collected and stamped in
        // batches instead of one query pair per fee
        const settlementChargeIds: string[] = [];
        for await (const fees of ApplicationFee.select()
            .where('balanceItemId', balanceItemPayments.map(b => b.balanceItemId))
            .limit(FEE_BATCH_SIZE)
            .allBatched()) {
            settlementChargeIds.push(...fees.map(fee => fee.settlementChargeId).filter((id): id is string => id !== null));
        }

        await SettlementService.setChargeProviderInvoiceIds(settlementChargeIds, invoice?.number ?? null);
    }
}
