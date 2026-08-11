import { StripeCheckoutSession, StripePaymentIntent } from '@stamhoofd/models';
import type Stripe from 'stripe';

/**
 * Maps Stripe charge ids to local payment ids. Shared across one sync run: the platform payout walk
 * resolves most charges cheaply and the connected walk then rarely needs the expensive
 * checkout-session fallback.
 */
export type StripePaymentIdCache = Map<string, string>;

/**
 * Find the local payment behind a Stripe charge: charge metadata → application fee's originating
 * transaction metadata → StripePaymentIntent → StripeCheckoutSession. Returns null when nothing
 * matches: the caller decides whether that is an error.
 *
 * The `stripePlatform` client must not be account-scoped: checkout sessions live on the platform
 * account.
 */
export async function resolveStripePaymentId(charge: Stripe.Charge, { stripePlatform, cache }: { stripePlatform: Stripe; cache?: StripePaymentIdCache }): Promise<string | null> {
    // A destination charge shows up twice: as the platform charge (the application fee's
    // originating transaction) and as the charge on the connected account. Both point to the same
    // payment, so both are usable candidates and both warm the cache.
    const candidates: Stripe.Charge[] = [charge];

    if (charge.application_fee && typeof charge.application_fee !== 'string') {
        const originatingTransaction = charge.application_fee.originating_transaction;
        if (originatingTransaction && typeof originatingTransaction !== 'string') {
            candidates.push(originatingTransaction as Stripe.Charge);
        }
    }

    const remember = (paymentId: string) => {
        for (const candidate of candidates) {
            cache?.set(candidate.id, paymentId);
        }
        return paymentId;
    };

    for (const candidate of candidates) {
        const cached = cache?.get(candidate.id);
        if (cached) {
            return remember(cached);
        }
    }

    for (const candidate of candidates) {
        const paymentId = candidate.metadata?.payment;
        if (paymentId) {
            return remember(paymentId);
        }
    }

    // Historical bug where we didn't save payment in metadata: try to look it up by payment intent
    for (const candidate of candidates) {
        if (!candidate.payment_intent) {
            continue;
        }
        const paymentIntentId = typeof candidate.payment_intent === 'string' ? candidate.payment_intent : candidate.payment_intent.id;

        const stripePayments = await StripePaymentIntent.where({
            stripeIntentId: paymentIntentId,
        }, { limit: 1 });

        if (stripePayments.length === 1) {
            console.log('Found missing payment metadata for payment intent', paymentIntentId, stripePayments[0].paymentId);
            return remember(stripePayments[0].paymentId);
        }

        // Probably a card payment: search for the checkout session
        const checkoutSessions = await stripePlatform.checkout.sessions.list({
            payment_intent: paymentIntentId,
        });

        if (checkoutSessions.data.length !== 1) {
            console.log('No Stripe Checkout Sessions found for payment intent ' + paymentIntentId);
            continue;
        }

        const stripeCheckoutSessions = await StripeCheckoutSession.where({
            stripeSessionId: checkoutSessions.data[0].id,
        }, { limit: 1 });

        if (stripeCheckoutSessions.length === 1) {
            console.log('Found missing payment metadata for payment intent', paymentIntentId, stripeCheckoutSessions[0].paymentId);
            return remember(stripeCheckoutSessions[0].paymentId);
        }

        console.log('No payment found for checkout session ' + checkoutSessions.data[0].id);
    }

    return null;
}
