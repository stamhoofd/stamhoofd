import { Payment, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { exceedsRemainingRefundableAmount, getRemainingRefundableAmount } from './refundAmount';

function createPayment(overrides: Partial<{ price: number; refundedAmount: number; pendingRefundAmount: number }> = {}) {
    return Payment.create({
        method: PaymentMethod.Bancontact,
        status: PaymentStatus.Succeeded,
        price: overrides.price ?? 6_88_00,
        refundedAmount: overrides.refundedAmount ?? 0,
        pendingRefundAmount: overrides.pendingRefundAmount ?? 0,
    });
}

describe('refundAmount', () => {
    test('remaining amount subtracts completed and pending refunds', () => {
        const payment = createPayment({ price: 10_00_00, refundedAmount: -2_00_00, pendingRefundAmount: -1_50_00 });
        expect(getRemainingRefundableAmount(payment)).toBe(6_50_00);
    });

    test('a refund with sub-cent balance item prices that rounds to the remaining amount is allowed', () => {
        expect(exceedsRemainingRefundableAmount(-6_88_20, createPayment({ price: 6_88_00 }))).toBe(false);
        expect(exceedsRemainingRefundableAmount(-6_87_50, createPayment({ price: 6_88_00 }))).toBe(false);
    });

    test('a refund that rounds above the remaining amount is refused', () => {
        expect(exceedsRemainingRefundableAmount(-6_88_50, createPayment({ price: 6_88_00 }))).toBe(true);
        expect(exceedsRemainingRefundableAmount(-6_89_00, createPayment({ price: 6_88_00 }))).toBe(true);
    });

    test('pending refunds reduce what can be refunded', () => {
        const payment = createPayment({ price: 6_88_00, pendingRefundAmount: -6_88_00 });
        expect(exceedsRemainingRefundableAmount(-1_00, payment)).toBe(true);
        expect(exceedsRemainingRefundableAmount(-6_88_00, createPayment({ price: 6_88_00 }))).toBe(false);
    });
});
