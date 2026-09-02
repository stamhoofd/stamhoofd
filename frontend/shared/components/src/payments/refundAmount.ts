import { Payment } from '@stamhoofd/structures';

/**
 * The amount that can still be refunded via this payment
 * (note: refundedAmount and pendingRefundAmount are negative)
 */
export function getRemainingRefundableAmount(payment: Payment) {
    return payment.price + payment.refundedAmount + payment.pendingRefundAmount;
}

/**
 * Whether a refund with the given (negative) total of balance item prices exceeds what can
 * still be refunded via the source payment. Balance item prices can contain fractions of a
 * cent, while payments are rounded to whole cents: the refund is rounded the same way the
 * backend rounds it, so both sides are compared in whole cents.
 */
export function exceedsRemainingRefundableAmount(total: number, sourcePayment: Payment) {
    return -Payment.roundPrice(total) > getRemainingRefundableAmount(sourcePayment);
}
