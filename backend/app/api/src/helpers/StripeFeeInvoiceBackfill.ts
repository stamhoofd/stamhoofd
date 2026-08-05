import { Email } from '@stamhoofd/email';
import type { Organization } from '@stamhoofd/models';
import { BalanceItem, BalanceItemPayment, Payment, StripeAccount } from '@stamhoofd/models';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { SQL } from '@stamhoofd/sql';
import { BalanceItemType, PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { Formatter } from '@stamhoofd/utility';

import { SettlementService } from '../services/SettlementService.js';
import { StripeInvoicer } from './StripeInvoicer.js';

export type BackfillResult = {
    /**
     * Received fee rows marked as invoiced.
     */
    invoicedCount: number;

    /**
     * (account, month) buckets whose stored rows disagree with what was actually charged.
     */
    mismatchCount: number;

    /**
     * (account, month) buckets the invoicer didn't reach yet.
     */
    notInvoicedCount: number;
};

/**
 * Marks the stored Received fee rows of months the old invoicer already billed as invoiced:
 * service rows get the month's ServiceFee balance item, transfer rows the TransferFee item.
 *
 * Per (account, month) the sum of the stored rows must equal the fee payment's price — that
 * assertion doubles as the proof that the stored data reproduces what was actually charged, the
 * gate for switching the invoicer to local data. A mismatch marks nothing and sends an email.
 */
export class StripeFeeInvoiceBackfill {
    /**
     * Backfill every month from `start` up to the last full month.
     */
    static async backfillAll(sellingOrganization: Organization, { start = new Date(2025, 0, 1) }: { start?: Date } = {}): Promise<BackfillResult> {
        const result: BackfillResult = { invoicedCount: 0, mismatchCount: 0, notInvoicedCount: 0 };
        let currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);

        while (true) {
            const { end } = StripeInvoicer.getMonthUnixStartEnd(currentMonth);
            if (end >= Date.now() / 1000) {
                break;
            }

            const monthResult = await this.backfillMonth(sellingOrganization, currentMonth);
            result.invoicedCount += monthResult.invoicedCount;
            result.mismatchCount += monthResult.mismatchCount;
            result.notInvoicedCount += monthResult.notInvoicedCount;

            currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        }

        return result;
    }

    static async backfillMonth(sellingOrganization: Organization, month: Date): Promise<BackfillResult> {
        const result: BackfillResult = { invoicedCount: 0, mismatchCount: 0, notInvoicedCount: 0 };

        const periodStart = SettlementService.getPeriodStart(month);
        const nextPeriodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1);
        const reference = 'stripe-fees-' + Formatter.dateIso(periodStart);

        // The month bucket is derived from the fee's created date, exactly like the old invoicer
        // scans the Stripe API per month
        const rows = await SettlementCharge.select()
            .where('type', [SettlementChargeType.ReceivedApplicationFeeService, SettlementChargeType.ReceivedApplicationFeeTransfer])
            .where('occurredAt', '>=', periodStart)
            .where('occurredAt', '<', nextPeriodStart)
            .fetch();

        const byAccount = new Map<string | null, SettlementCharge[]>();
        for (const row of rows) {
            const group = byAccount.get(row.stripeAccountId);
            if (group) {
                group.push(row);
            } else {
                byAccount.set(row.stripeAccountId, [row]);
            }
        }

        for (const [stripeAccountId, accountRows] of byAccount) {
            const mismatch = (reason: string) => {
                result.mismatchCount += 1;
                console.error('Invoice backfill mismatch for ' + reference + ' / account ' + stripeAccountId + ': ' + reason);
                Email.sendWebmaster({
                    subject: 'Stripe kosten afpunten met de factuur mislukt voor ' + reference,
                    html: 'De opgeslagen Stripe kosten voor ' + reference + ' (account ' + stripeAccountId + ') komen niet overeen met wat gefactureerd is. Er is niets afgepunt. <br><br> ' + Formatter.escapeHtml(reason),
                });
            };

            if (!stripeAccountId) {
                mismatch('Received fee rows without a Stripe account');
                continue;
            }

            const stripeAccount = await StripeAccount.getByID(stripeAccountId);
            if (!stripeAccount) {
                mismatch('Stripe account ' + stripeAccountId + ' does not exist');
                continue;
            }

            // Same query as the invoicer's idempotency check: the OR NULL clause covers legacy
            // payments that were created without a stripeAccountId
            const payments = await Payment.select()
                .where('organizationId', sellingOrganization.id)
                .where('payingOrganizationId', stripeAccount.organizationId)
                .where(
                    SQL.where('stripeAccountId', stripeAccount.id)
                        .or('stripeAccountId', null),
                )
                .where('reference', reference)
                .where('method', PaymentMethod.AccountDeductions)
                .where('provider', PaymentProvider.Stripe)
                .where('status', PaymentStatus.Succeeded)
                .fetch();

            if (payments.length === 0) {
                // Not invoiced yet: the month waits for the invoicer, nothing to mark
                result.notInvoicedCount += 1;
                continue;
            }

            if (payments.length > 1) {
                mismatch('Found ' + payments.length + ' fee payments for the same month');
                continue;
            }

            const payment = payments[0];
            const total = accountRows.reduce((sum, row) => sum + row.amount, 0);

            if (total !== payment.price) {
                mismatch('Stored fee rows sum to ' + total + ' but the fee payment charged ' + payment.price + ' (payment ' + payment.id + ')');
                continue;
            }

            const balanceItemPayments = await BalanceItemPayment.select()
                .where('paymentId', payment.id)
                .fetch();
            const balanceItems = balanceItemPayments.length > 0
                ? await BalanceItem.select().where('id', balanceItemPayments.map(b => b.balanceItemId)).fetch()
                : [];

            const itemPerType = new Map<SettlementChargeType, BalanceItem | undefined>([
                [SettlementChargeType.ReceivedApplicationFeeService, balanceItems.find(i => i.type === BalanceItemType.ServiceFee)],
                [SettlementChargeType.ReceivedApplicationFeeTransfer, balanceItems.find(i => i.type === BalanceItemType.TransferFee)],
            ]);

            const missing = accountRows.find(row => !itemPerType.get(row.type));
            if (missing) {
                mismatch('The fee payment has no ' + (missing.type === SettlementChargeType.ReceivedApplicationFeeService ? 'ServiceFee' : 'TransferFee') + ' balance item (payment ' + payment.id + ')');
                continue;
            }

            // Marking is permanent: also assert the service/transfer split, not just the total
            const splitMismatch = [...itemPerType.entries()].find(([type, item]) => {
                const typeTotal = accountRows.filter(row => row.type === type).reduce((sum, row) => sum + row.amount, 0);
                return item !== undefined && typeTotal !== item.priceWithVAT;
            });
            if (splitMismatch) {
                mismatch('The stored ' + splitMismatch[0] + ' rows do not sum to the ' + splitMismatch[1]!.type + ' balance item of payment ' + payment.id);
                continue;
            }

            for (const row of accountRows) {
                await SettlementService.markInvoiced(row, itemPerType.get(row.type)!.id);
                result.invoicedCount += 1;
            }
        }

        return result;
    }
}
