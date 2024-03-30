
import { AnyDecoder, AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, StripeAccount, StripeCheckoutSession, StripePaymentIntent } from '@stamhoofd/models';

import { StripeHelper } from '../../../helpers/StripeHelper';
import { ExchangePaymentEndpoint } from '../../organization/shared/ExchangePaymentEndpoint';

type Params = Record<string, never>;
class Body extends AutoEncoder {
    /**
     * The account id (internal id, not the stripe id)
     */
    @field({ decoder: StringDecoder })
    type: string

    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: AnyDecoder })
    data: any
}

type Query = undefined
type ResponseBody = undefined

export class StripeWebookEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/stripe/webhooks", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        console.log("Received Stripe Webhook", request.body.type);

        // Verify webhook signature and extract the event.
        // See https://stripe.com/docs/webhooks/signatures for more information.
        let event;
        try {
            const stripe = StripeHelper.getInstance()
            const sig = request.headers['stripe-signature'];
            if (!sig) {
                throw new SimpleError({
                    code: "invalid_signature",
                    message: "Invalid signature",
                    statusCode: 400
                })
            }
            event = await stripe.webhooks.constructEventAsync(await request.request.bodyPromise!, sig, STAMHOOFD.STRIPE_ENDPOINT_SECRET);
        } catch (err) {
            throw new SimpleError({
                code: "invalid_signature",
                message: "Invalid signature",
                statusCode: 400
            })
        }

        // Check type
        switch (request.body.type) {
            case "account.updated": {
                console.log(event);
                const account = request.body.data.object;
                if (account && account.id) {
                    const id = account.id as string;
                    const [model] = await StripeAccount.where({accountId: id}, {limit: 1});
                    if (model) {
                        model.setMetaFromStripeAccount(account)
                        await model.save()
                    } else {
                        console.warn("Could not find stripe account with id", id)
                    }
                }
                break;
            }
            case "payment_intent.amount_capturable_updated":
            case "payment_intent.canceled":
            case "payment_intent.created":
            case "payment_intent.partially_funded":
            case "payment_intent.payment_failed":
            case "payment_intent.processing":
            case "payment_intent.requires_action":
            case "payment_intent.succeeded": {
                const intentId = request.body.data.object.id;
                const [model] = await StripePaymentIntent.where({stripeIntentId: intentId}, {limit: 1})
                if (model && model.organizationId) {
                    const organization = await Organization.getByID(model.organizationId)
                    if (organization) {
                        await ExchangePaymentEndpoint.pollStatus(model.paymentId, organization)
                    } else {
                        console.warn("Could not find organization with id", model.organizationId)
                    }
                } else {
                    console.warn("Could not find stripe payment intent with id", intentId)
                }
                break;
            }
            case "checkout.session.async_payment_failed":
            case "checkout.session.async_payment_succeeded":
            case "checkout.session.completed":
            case "checkout.session.expired": {
                const checkoutId = request.body.data.object.id;
                const [model] = await StripeCheckoutSession.where({stripeSessionId: checkoutId}, {limit: 1})
                if (model && model.organizationId) {
                    const organization = await Organization.getByID(model.organizationId)
                    if (organization) {
                        await ExchangePaymentEndpoint.pollStatus(model.paymentId, organization)
                    } else {
                        console.warn("Could not find organization with id", model.organizationId)
                    }
                } else {
                    console.warn("Could not find stripe checkout session with id", checkoutId)
                }
                break;
            }
            default: {
                console.log("Unhandled stripe webhook type", request.body.type);
                break;
            }
        }
        return new Response(undefined);
    }
}
