import { StripeCheckoutSession, StripePaymentIntent } from '@stamhoofd/models';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import { passthroughFetch } from './passthroughFetch.js';
import { resolveStripePaymentId } from './resolveStripePaymentId.js';

describe('resolveStripePaymentId', () => {
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

        expect(await resolveStripePaymentId(charge, { stripePlatform })).toBe(paymentId);
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

        expect(await resolveStripePaymentId(charge, { stripePlatform })).toBe(paymentId);
    });

    test('falls back to a stored StripePaymentIntent', async () => {
        const paymentId = uuidv4();
        const intentId = stripeMocker.createId('pi');

        const intent = new StripePaymentIntent();
        intent.paymentId = paymentId;
        intent.stripeIntentId = intentId;
        await intent.save();

        const charge = asCharge({ payment_intent: intentId });

        expect(await resolveStripePaymentId(charge, { stripePlatform })).toBe(paymentId);
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

        expect(await resolveStripePaymentId(charge, { stripePlatform })).toBe(paymentId);
    });

    test('returns null when nothing matches', async () => {
        const charge = asCharge({ payment_intent: stripeMocker.createId('pi') });

        expect(await resolveStripePaymentId(charge, { stripePlatform })).toBe(null);
    });

    test('a resolution warms the cache for the charge and its originating transaction', async () => {
        const paymentId = uuidv4();
        const originating = asCharge({ metadata: { payment: paymentId } });
        const charge = asCharge({
            application_fee: stripeMocker.createApplicationFee({
                amount: 250,
                account: 'acct_1',
                originatingTransaction: originating,
            }),
        });

        const cache = new Map<string, string>();
        expect(await resolveStripePaymentId(charge, { stripePlatform, cache })).toBe(paymentId);
        expect(cache.get(charge.id)).toBe(paymentId);
        expect(cache.get(originating.id)).toBe(paymentId);

        // The platform walk warmed the cache with the originating charge id: the connected-side
        // charge without any metadata still resolves without network or database lookups
        const bare = asCharge({ id: originating.id, metadata: {} });
        expect(await resolveStripePaymentId(bare, { stripePlatform, cache })).toBe(paymentId);
    });
});
