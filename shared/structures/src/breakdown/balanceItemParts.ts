import type { BalanceItem, BalanceItemPaymentWithPrivatePayment } from '../BalanceItem.js';
import type { BreakdownGroup } from '../PaymentBreakdown.js';
import { BreakdownAmountType } from '../PaymentBreakdown.js';
import { getPaymentSettlement, getPendingPaymentGroup, PENDING_PAYMENT_ID } from '../PaymentSettlementGroups.js';
import { PaymentStatus } from '../PaymentStatus.js';
import { createBalanceItemGroup, createFailedGroup, createOpenAfterFailedGroup, createOpenGroup, createRefundGroup, REFUND_ID, UNPAID_FAILED_ID, UNPAID_OPEN_AFTER_FAILED_ID, UNPAID_OPEN_ID } from './breakdownGroups.js';

/**
 * One part of what a balance item costs, and where that part ended up: paid out in a payout, still
 * being processed, tried and failed, or not paid at all.
 *
 * Every part of a balance item lands in exactly one of these, so together they add up to what was
 * charged.
 */
export type BalanceItemPart = {
    /**
     * Identifies the row this part lands in, and is what a request sends back to narrow down to it.
     */
    id: string;
    price: number;

    /**
     * Which money of the balance item this part is, so a row that holds it can say what it measures.
     */
    amountType: BreakdownAmountType;
    createGroup: () => BreakdownGroup;
};

/**
 * Splits what a balance item costs over the payouts it was part of and over what is not paid out (yet).
 *
 * A balance item doesn't carry any of this itself, so everything is read from the payments that paid for
 * it: only the money that actually came in was ever paid out, and what is left is still on its way or
 * was never paid.
 *
 * A part lands in a row exactly when the row's filter selects the item, so the list and the export
 * behind a row hold exactly what it was added up from.
 */
export function getBalanceItemParts(item: BalanceItem, payments: BalanceItemPaymentWithPrivatePayment[]): BalanceItemPart[] {
    const parts = new Map<string, BalanceItemPart>();
    const add = (id: string, price: number, amountType: BreakdownAmountType, createGroup: () => BreakdownGroup) => {
        const existing = parts.get(id);

        if (existing) {
            existing.price += price;
            return;
        }

        parts.set(id, { id, price, amountType, createGroup });
    };

    let paid = 0;
    let pending = 0;
    let failed = 0;
    let hasPending = false;
    let hasFailed = false;

    for (const { payment, price } of payments) {
        const group = getPaymentSettlement(payment);

        if (payment.status === PaymentStatus.Succeeded) {
            paid += price;
            add(group.id, price, BreakdownAmountType.Paid, () => createBalanceItemGroup(group, BreakdownAmountType.Paid));
            continue;
        }

        if (payment.status === PaymentStatus.Failed) {
            // What a failed payment tried to pay is not owed twice: it is still part of what is open
            failed += price;
            hasFailed = true;
            continue;
        }

        pending += price;
        hasPending = true;
    }

    if (hasPending) {
        add(PENDING_PAYMENT_ID, pending, BreakdownAmountType.Pending, () => createBalanceItemGroup(getPendingPaymentGroup(), BreakdownAmountType.Pending));
    }

    // What is left of what was charged after everything that came in and everything that is on its way.
    // This is what BalanceItem.priceOpen holds, which is how these rows select their items again.
    const open = item.payablePriceWithVAT - paid - pending;

    if (open < 0) {
        // Paid more than what is owed, e.g. a canceled item that was already paid for
        add(REFUND_ID, open, BreakdownAmountType.Open, createRefundGroup);
        return [...parts.values()];
    }

    if (open > 0) {
        // Every attempt is money someone tried to hand over, so the failed row holds all of them
        // together, never more than what is still owed
        const failedPart = Math.min(open, failed);

        if (failedPart > 0) {
            add(UNPAID_FAILED_ID, failedPart, BreakdownAmountType.Open, createFailedGroup);
        }

        if (open > failedPart) {
            add(
                hasFailed ? UNPAID_OPEN_AFTER_FAILED_ID : UNPAID_OPEN_ID,
                open - failedPart,
                BreakdownAmountType.Open,
                hasFailed ? createOpenAfterFailedGroup : createOpenGroup,
            );
        }
    }

    return [...parts.values()];
}
