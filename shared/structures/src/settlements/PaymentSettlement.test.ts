import { PaymentProvider } from '../PaymentProvider.js';
import { getPrimaryPaymentSettlement, PaymentSettlementDetailed } from './PaymentSettlement.js';
import { Settlement } from './Settlement.js';

describe('getPrimaryPaymentSettlement', () => {
    const line = ({ amount, settledAt, externalId = 'txn_' + amount.toString() }: { amount: number; settledAt: Date; externalId?: string }) => {
        return PaymentSettlementDetailed.create({
            settlementId: 'settlement-' + externalId,
            paymentId: 'payment',
            amount,
            externalId,
            occurredAt: settledAt,
            settlement: Settlement.create({
                provider: PaymentProvider.Stripe,
                externalId: 'po_' + externalId,
                settledAt,
            }),
        });
    };

    test('no settlements means no primary', () => {
        expect(getPrimaryPaymentSettlement([])).toBeNull();
    });

    test('the largest line wins: the payment payout beats its refund payout', () => {
        const payment = line({ amount: 50_00_00, settledAt: new Date(2026, 0, 15) });
        const refund = line({ amount: -20_00_00, settledAt: new Date(2026, 0, 22) });

        expect(getPrimaryPaymentSettlement([refund, payment])).toBe(payment);
    });

    test('equal amounts fall back to the earliest payout, then the external id', () => {
        const earlier = line({ amount: 50_00_00, settledAt: new Date(2026, 0, 10), externalId: 'txn_b' });
        const later = line({ amount: -50_00_00, settledAt: new Date(2026, 0, 20), externalId: 'txn_a' });
        expect(getPrimaryPaymentSettlement([later, earlier])).toBe(earlier);

        const twinA = line({ amount: 50_00_00, settledAt: new Date(2026, 0, 10), externalId: 'txn_a' });
        const twinB = line({ amount: 50_00_00, settledAt: new Date(2026, 0, 10), externalId: 'txn_b' });
        expect(getPrimaryPaymentSettlement([twinB, twinA])).toBe(twinA);
    });

    test('the input array is left untouched', () => {
        const first = line({ amount: 10_00_00, settledAt: new Date(2026, 0, 10) });
        const second = line({ amount: 50_00_00, settledAt: new Date(2026, 0, 15) });
        const input = [first, second];

        getPrimaryPaymentSettlement(input);
        expect(input).toEqual([first, second]);
    });
});
