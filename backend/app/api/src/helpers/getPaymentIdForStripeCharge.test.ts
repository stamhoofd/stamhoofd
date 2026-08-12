import { StripeCheckoutSession, StripePaymentIntent } from '@stamhoofd/models';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import { passthroughFetch } from './passthroughFetch.js';
import { getPaymentIdForStripeCharge } from './getPaymentIdForStripeCharge.js';

describe('getPaymentIdForStripeCharge', () => {
    const stripeMocker = new StripeMocker();
    let stripePlatform: Stripe;

    beforeAll(() => {
        stripeMocker.start();
        stripePlatform = new Stripe(STAMHOOFD.STRIPE_SECRET_KEY!, {
            apiVersion: '2024-06-20',
            typescript: true,
            maxNetworkRetries: 0,
            timeout: 10000,
            httpClient: Stripe.createFetchHttpClient(passthroughFetch),
        });
    });

    afterAll(() => {
        stripeMocker.stop();
    });

    beforeEach(() => {
        stripeMocker.clear();
    });

    const asCharge = (data: Record<string, unknown>): Stripe.Charge => {
        return { id: stripeMocker.createId('ch'), object: 'charge', metadata: {}, ...data } as unknown as Stripe.Charge;
    };

    test('the payment metadata on the charge wins', async () => {
        const paymentId = uuidv4();
        const charge = asCharge({ metadata: { payment: paymentId } });

        expect(await getPaymentIdForStripeCharge(charge, { stripePlatform })).toBe(paymentId);
    });

    test('falls back to the metadata of the application fee originating transaction', async () => {
        const paymentId = uuidv4();
        const originating = asCharge({ metadata: { payment: paymentId } });
        const charge = asCharge({
            application_fee: stripeMocker.createApplicationFee({
                amount: 250,
                account: 'acct_1',
                originatingTransaction: originating,
            }),
        });

        expect(await getPaymentIdForStripeCharge(charge, { stripePlatform })).toBe(paymentId);
    });

    test('falls back to a stored StripePaymentIntent', async () => {
        const paymentId = uuidv4();
        const intentId = stripeMocker.createId('pi');

        const intent = new StripePaymentIntent();
        intent.paymentId = paymentId;
        intent.stripeIntentId = intentId;
        await intent.save();

        const charge = asCharge({ payment_intent: intentId });

        expect(await getPaymentIdForStripeCharge(charge, { stripePlatform })).toBe(paymentId);
    });

    test('falls back to the checkout session of the payment intent', async () => {
        const paymentId = uuidv4();
        const intentId = stripeMocker.createId('pi');
        const mockedSession = stripeMocker.createCheckoutSession({ paymentIntent: intentId });

        const session = new StripeCheckoutSession();
        session.paymentId = paymentId;
        session.stripeSessionId = mockedSession.id;
        await session.save();

        const charge = asCharge({ payment_intent: intentId });

        expect(await getPaymentIdForStripeCharge(charge, { stripePlatform })).toBe(paymentId);
    });

    test('returns null when nothing matches', async () => {
        const charge = asCharge({ payment_intent: stripeMocker.createId('pi') });

        expect(await getPaymentIdForStripeCharge(charge, { stripePlatform })).toBe(null);
    });
});
