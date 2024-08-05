import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { BalanceItem, BalanceItemPayment, Organization, Payment, StripeAccount, StripeCheckoutSession, StripePaymentIntent } from '@stamhoofd/models';
import { calculateVATPercentage, PaymentMethod, PaymentMethodHelper, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import Stripe from 'stripe';

export class StripeHelper {
    static getInstance(accountId: string|null = null) {
        return new Stripe(STAMHOOFD.STRIPE_SECRET_KEY, {apiVersion: '2024-06-20', typescript: true, maxNetworkRetries: 0, timeout: 10000, stripeAccount: accountId ?? undefined});
    }

    static async saveChargeInfo(model: StripePaymentIntent|StripeCheckoutSession, charge: Stripe.Charge, payment: Payment) {
        try {
            if (model.accountId) {
                // This is a direct charge
                
                if (charge.balance_transaction !== null && typeof charge.balance_transaction !== 'string') {
                    const fees = charge.balance_transaction.fee;
                    payment.transferFee = fees;
                }
            }

            if (charge.billing_details.name) {
                payment.ibanName = charge.billing_details.name
            }

            if (charge.payment_method_details?.bancontact) {
                if (charge.payment_method_details.bancontact.iban_last4) {
                    payment.iban = "xxxx " + charge.payment_method_details.bancontact.iban_last4
                }
                payment.ibanName = charge.payment_method_details.bancontact.verified_name
            }
            if (charge.payment_method_details?.ideal) {
                if (charge.payment_method_details.ideal.iban_last4) {
                    payment.iban = "xxxx " + charge.payment_method_details.ideal.iban_last4
                }
                payment.ibanName = charge.payment_method_details.ideal.verified_name
            }
            if (charge.payment_method_details?.card) {
                if (charge.payment_method_details.card.last4) {
                    payment.iban = "xxxx " + charge.payment_method_details.card.last4
                }
            }
            await payment.save()
        } catch (e) {
            console.error('Failed processing charge', e)
        }
    }

    static async getStatus(payment: Payment, cancel = false, testMode = false): Promise<PaymentStatus> {
        if (testMode && !STAMHOOFD.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
            // Do not query anything
            return payment.status
        }

        const [model] = await StripePaymentIntent.where({paymentId: payment.id}, {limit: 1})

        if (!model) {
            return await this.getStatusFromCheckoutSession(payment, cancel)
        }

        const stripe = this.getInstance(model.accountId)

        let intent = await stripe.paymentIntents.retrieve(model.stripeIntentId, {
            expand: ['latest_charge.balance_transaction']
        })
        console.log(intent);
        if (intent.status === "succeeded") {
            if (intent.latest_charge !== null && typeof intent.latest_charge !== 'string') {
                await this.saveChargeInfo(model, intent.latest_charge, payment)
            }
            return PaymentStatus.Succeeded
        }
        if (intent.status === "canceled" || intent.status === "requires_payment_method") {
            // For Bnaconctact/iDEAL the payment status is reverted to requires_payment_method when the user cancels the payment
            // Don't ask me why...
            return PaymentStatus.Failed
        }

        if (cancel) {
            try {
                // Cancel the intent
                console.log('Cancelling payment intent')
                intent = await stripe.paymentIntents.cancel(model.stripeIntentId)
                console.log('Cancelled payment intent', intent)

                if (intent.status === "succeeded") {
                    return PaymentStatus.Succeeded
                }
                if (intent.status === "canceled" || intent.status === "requires_payment_method") {
                    return PaymentStatus.Failed
                }
            } catch (e) {
                console.error('Error cancelling payment intent', e)
            }
        }

        if (intent.status === "processing") {
            return PaymentStatus.Pending
        }
        return PaymentStatus.Created
    }

    static async getStatusFromCheckoutSession(payment: Payment, cancel = false): Promise<PaymentStatus> {
        const [model] = await StripeCheckoutSession.where({paymentId: payment.id}, {limit: 1})

        if (!model) {
            return PaymentStatus.Failed
        }

        const stripe = this.getInstance(model.accountId)
        const session = await stripe.checkout.sessions.retrieve(model.stripeSessionId, {
            expand: ['payment_intent.latest_charge.balance_transaction']
        })

        console.log("session", session);

        if (session.status === "complete") {
            // This is a direct charge
            const payment_intent = session.payment_intent
            if (payment_intent !== null && typeof payment_intent !== 'string') {
                const charge = payment_intent.latest_charge
                if (charge !== null && typeof charge !== 'string') {
                    await this.saveChargeInfo(model, charge, payment)
                }
            }
            return PaymentStatus.Succeeded
        }
        if (session.status === "expired") {
            return PaymentStatus.Failed
        }

        if (cancel) {
            // Cancel the session
            const session = await stripe.checkout.sessions.expire(model.stripeSessionId)

            if (session.status === "complete") {
                return PaymentStatus.Succeeded
            }
            if (session.status === "expired") {
                return PaymentStatus.Failed
            }
        }

        return PaymentStatus.Created
    }

    static async createPayment(
        {payment, stripeAccount, redirectUrl, cancelUrl, customer, statementDescriptor, i18n, metadata, organization, lineItems}: {
            payment: Payment, 
            stripeAccount: StripeAccount | null, 
            redirectUrl: string, 
            cancelUrl: string, 
            customer: {
                name: string, 
                email: string, 
            },
            statementDescriptor: string,
            i18n: I18n,
            metadata: {[key: string]: string},
            organization: Organization,
            lineItems: (BalanceItemPayment & {balanceItem: BalanceItem})[],
        }
    ): Promise<{paymentUrl: string}> {
        if (!stripeAccount) {
            throw new SimpleError({
                code: "",
                message: "Betaling via " + PaymentMethodHelper.getName(payment.method) + " is onbeschikbaar"
            })
        }

        const totalPrice = payment.price;

        let fee = 0;
        let directCharge = false;
        const vat = calculateVATPercentage(organization.address, organization.meta.VATNumber)
        function calculateFee(fixed: number, percentageTimes100: number) {
            return Math.round(Math.round(fixed + Math.max(1, totalPrice * percentageTimes100 / 100 / 100)) * (100 + vat) / 100); // € 0,21 + 0,2%
        }

        if (payment.method === PaymentMethod.iDEAL) {
            fee = calculateFee(21, 20); // € 0,21 + 0,2%
        } else if (payment.method === PaymentMethod.Bancontact) {
            fee = calculateFee(24, 20); // € 0,24 + 0,2%
        } else {
            fee = calculateFee(25, 150); // € 0,25 + 1,5%
        }

        if (stripeAccount.meta.type === 'standard') {
            // Submerchant is charged by Stripe for the fees directly
            fee = 0;
            directCharge = true;
        }

        payment.transferFee = fee;

        const fullMetadata = {
            ...(metadata ?? {}),
            organizationVATNumber: organization.meta.VATNumber
        }

        const stripe = StripeHelper.getInstance(directCharge ? stripeAccount.accountId : null)
        let paymentUrl: string

        // Bancontact or iDEAL: use payment intends
        if (payment.method === PaymentMethod.Bancontact || payment.method === PaymentMethod.iDEAL) {
            const paymentMethod = await stripe.paymentMethods.create({
                type: payment.method.toLowerCase() as 'bancontact',
                billing_details: {
                    name: customer.name && customer.name.length > 2 ? customer.name : 'Onbekend',
                    email: customer.email
                },
            })

            const paymentIntent = await stripe.paymentIntents.create({
                amount: totalPrice,
                currency: 'eur',
                payment_method: paymentMethod.id,
                payment_method_types: [payment.method.toLowerCase()],
                statement_descriptor: Formatter.slug(statementDescriptor).substring(0, 22).toUpperCase(),
                application_fee_amount: fee,
                on_behalf_of: !directCharge ? stripeAccount.accountId : undefined,
                confirm: true,
                return_url: redirectUrl,
                transfer_data: !directCharge ?  {
                    destination: stripeAccount.accountId,
                } : undefined,
                metadata: fullMetadata,
                payment_method_options: {bancontact: {preferred_language: ['nl', 'fr', 'de', 'en'].includes(i18n.language) ? i18n.language as 'en' : 'nl'}},
            });

            console.log("Stripe payment intent", paymentIntent)
            const url = paymentIntent.next_action?.redirect_to_url?.url

            if (paymentIntent.status !== 'requires_action' || !url) {
                console.error("Stripe payment intent status is not requires_action", paymentIntent)
                throw new SimpleError({
                    code: "invalid_status",
                    message: "Betaling via " + PaymentMethodHelper.getName(payment.method) + " is onbeschikbaar"
                })
            }

            paymentUrl = url

            // Store in database
            const paymentIntentModel = new StripePaymentIntent()
            paymentIntentModel.paymentId = payment.id
            paymentIntentModel.stripeIntentId = paymentIntent.id
            paymentIntentModel.organizationId = organization.id

            if (directCharge) {
                paymentIntentModel.accountId = stripeAccount.accountId
            }
            await paymentIntentModel.save()
        } else {
            // Build Stripe line items
            const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
            let lineItemsPrice = 0
            for (const item of lineItems) {
                const stripeLineItem = {
                    price_data: {
                        currency: 'eur',
                        unit_amount: item.price,
                        product_data: {
                            name: item.balanceItem.description,
                        },
                    },
                    quantity: 1,
                }
                stripeLineItems.push(stripeLineItem)
                lineItemsPrice += item.price
            }

            if (lineItemsPrice !== totalPrice) {
                console.error('Total price of line items does not match total price of payment', lineItemsPrice, totalPrice, payment.id)
                throw new SimpleError({
                    code: "invalid_price",
                    message: "De totale prijs van de betaling komt niet overeen met de prijs van de items",
                    human: "Er ging iets mis bij het aanmaken van de betaling. Probeer opnieuw of gebruik een andere betaalmethode.",
                    statusCode: 500
                })
            }

            // Use checkout flow
            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                success_url: redirectUrl,
                cancel_url: cancelUrl,
                payment_method_types: ["card"],
                line_items: stripeLineItems,
                currency: 'eur',
                locale: i18n.language as 'nl',
                payment_intent_data: {
                    on_behalf_of: !directCharge ? stripeAccount.accountId : undefined,
                    application_fee_amount: fee,
                    transfer_data: !directCharge ? {
                        destination: stripeAccount.accountId,
                    } : undefined,
                    metadata: fullMetadata,
                    statement_descriptor: Formatter.slug(statementDescriptor).substring(0, 22).toUpperCase(),
                },
                customer_email: customer.email,
                metadata: fullMetadata,
                expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // Expire in 30 minutes
            });
            console.log("Stripe session", session)

            if (!session.url) {
                console.error("Stripe session has no url", session)
                throw new SimpleError({
                    code: "invalid_status",
                    message: "Betaling via " + PaymentMethodHelper.getName(payment.method) + " is onbeschikbaar"
                })
            }
            paymentUrl = session.url

            // Store in database
            const paymentIntentModel = new StripeCheckoutSession()
            paymentIntentModel.paymentId = payment.id
            paymentIntentModel.stripeSessionId = session.id
            paymentIntentModel.organizationId = organization.id

            if (directCharge) {
                paymentIntentModel.accountId = stripeAccount.accountId
            }
            await paymentIntentModel.save()
        }

        await payment.save()

        return {
            paymentUrl
        }
    }
}
