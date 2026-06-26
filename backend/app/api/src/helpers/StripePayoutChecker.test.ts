import { Payment } from '@stamhoofd/models';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import nock from 'nock';
import { resetNock } from '../../tests/helpers/resetNock.js';
import { StripePayoutChecker } from './StripePayoutChecker.js';

describe('StripePayoutChecker', () => {
    afterEach(() => {
        resetNock();
    });

    async function createPayment(props: { price: number; serviceFeePayout?: number }) {
        const payment = new Payment();
        payment.method = PaymentMethod.iDEAL;
        payment.status = PaymentStatus.Succeeded;
        payment.provider = PaymentProvider.Stripe;
        payment.price = props.price;
        payment.serviceFeePayout = props.serviceFeePayout ?? 0;
        await payment.save();
        return payment;
    }

    /**
     * Mock the two Stripe list endpoints the checker walks:
     * - GET /v1/payouts (status=paid)
     * - GET /v1/balance_transactions (filtered by payout)
     */
    function mockStripe({ payout, balanceTransaction }: { payout: any; balanceTransaction: any }) {
        nock('https://api.stripe.com')
            .get(/v1\/payouts.*/)
            .reply(200, {
                object: 'list',
                has_more: false,
                data: [payout],
            });

        nock('https://api.stripe.com')
            .get(/v1\/balance_transactions.*/)
            .reply(200, {
                object: 'list',
                has_more: false,
                data: [balanceTransaction],
            });
    }

    it('does not double-count the application fee in the transfer fee', async () => {
        // A € 10,00 payment. Stripe withholds € 0,35 in total fees from the connected
        // account (already including the application fee Stripe lists in fee_details).
        const payment = await createPayment({ price: 10_00_00 });

        const payout = {
            id: 'po_' + payment.id,
            object: 'payout',
            amount: 9_65, // cents
            arrival_date: Math.floor(Date.now() / 1000),
            statement_descriptor: 'PAYOUT',
        };

        const balanceTransaction = {
            id: 'txn_1',
            object: 'balance_transaction',
            type: 'charge',
            amount: 10_00, // cents (matches payment.price / 100)
            // Total fee withheld from the connected account, already includes the application fee.
            fee: 35, // cents
            source: {
                id: 'ch_1',
                object: 'charge',
                metadata: { payment: payment.id },
                // Stripe also exposes the application fee separately, but it is a SUBSET of `fee`.
                application_fee_amount: 30,
            },
        };

        mockStripe({ payout, balanceTransaction });

        const checker = new StripePayoutChecker({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });
        await checker.checkSettlements();

        const updated = (await Payment.getByID(payment.id))!;

        // transferFee should equal the total fee (€ 0,35), not fee + applicationFee (€ 0,65).
        expect(updated.transferFee).toBe(35 * 100);
        expect(updated.settlement?.fee).toBe(35 * 100);
    });

    it('subtracts the service fee payout from the transfer fee', async () => {
        const payment = await createPayment({ price: 10_00_00, serviceFeePayout: 10 * 100 });

        const payout = {
            id: 'po_' + payment.id,
            object: 'payout',
            amount: 9_65,
            arrival_date: Math.floor(Date.now() / 1000),
            statement_descriptor: 'PAYOUT',
        };

        const balanceTransaction = {
            id: 'txn_2',
            object: 'balance_transaction',
            type: 'charge',
            amount: 10_00,
            fee: 35, // total fee € 0,35, of which € 0,10 is our service fee
            source: {
                id: 'ch_2',
                object: 'charge',
                metadata: { payment: payment.id },
                application_fee_amount: 30,
            },
        };

        mockStripe({ payout, balanceTransaction });

        const checker = new StripePayoutChecker({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });
        await checker.checkSettlements();

        const updated = (await Payment.getByID(payment.id))!;

        // € 0,35 total fee - € 0,10 service fee payout = € 0,25 transfer fee
        expect(updated.transferFee).toBe(35 * 100 - 10 * 100);
        expect(updated.settlement?.fee).toBe(35 * 100);
    });
});
