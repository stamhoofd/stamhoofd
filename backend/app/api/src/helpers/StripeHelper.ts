import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { BalanceItem, BalanceItemPayment, Organization, Payment, StripeAccount, StripeCheckoutSession, StripePaymentIntent } from '@stamhoofd/models';
import { calculateVATPercentage, PaymentMethod, PaymentMethodHelper, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import Stripe from 'stripe';
import { passthroughFetch } from './passthroughFetch.js';

export class StripeHelper {
    static get notConfiguredError() {
        return new SimpleError({
            code: 'not_configured',
            message: 'Stripe is not yet configured for this platform',
            human: $t('4f1361c2-c860-46e7-a242-933bfe56a7ed'),
        });
    }

    static getInstance(accountId: string | null = null) {
        if (!STAMHOOFD.STRIPE_SECRET_KEY) {
            throw this.notConfiguredError;
        }
        return new Stripe(STAMHOOFD.STRIPE_SECRET_KEY, {
            apiVersion: '2024-06-20',
            typescript: true,
            maxNetworkRetries: 0,
            timeout: 10000,
            stripeAccount: accountId ?? undefined,
            httpClient: STAMHOOFD.environment === 'test'
                ? Stripe.createFetchHttpClient(passthroughFetch)
                : undefined,
        });
    }

    static async saveChargeInfo(model: StripePaymentIntent | StripeCheckoutSession, charge: Stripe.Charge, payment: Payment) {
        try {
            if (model.accountId) {
                // This is a direct charge

                if (charge.balance_transaction !== null && typeof charge.balance_transaction !== 'string') {
                    const fees = charge.balance_transaction.fee;
                    payment.transferFee = fees - payment.serviceFeePayout;
                }
            }

            if (charge.billing_details.name) {
                payment.ibanName = charge.billing_details.name;
            }

            if (charge.payment_method_details?.bancontact) {
                if (charge.payment_method_details.bancontact.iban_last4) {
                    payment.iban = '•••• ' + charge.payment_method_details.bancontact.iban_last4;
                }
                payment.ibanName = charge.payment_method_details.bancontact.verified_name;
            }
            if (charge.payment_method_details?.ideal) {
                if (charge.payment_method_details.ideal.iban_last4) {
                    payment.iban = '•••• ' + charge.payment_method_details.ideal.iban_last4;
                }
                payment.ibanName = charge.payment_method_details.ideal.verified_name;
            }
            if (charge.payment_method_details?.card) {
                if (charge.payment_method_details.card.last4) {
                    payment.iban = '•••• ' + charge.payment_method_details.card.last4;
                }
            }
            if (charge.payment_method_details?.sepa_debit) {
                if (charge.payment_method_details.sepa_debit.last4) {
                    if (charge.payment_method_details.sepa_debit.country === 'BE') {
                        payment.iban = charge.payment_method_details.sepa_debit.country + '•• ' + charge.payment_method_details.sepa_debit.bank_code + '• •••• ' + charge.payment_method_details.sepa_debit.last4;
                    }
                    else {
                        payment.iban = '•••• ' + charge.payment_method_details.sepa_debit.last4;
                    }
                }
            }
            await payment.save();
        }
        catch (e) {
            console.error('Failed processing charge', e);
        }
    }

    /**
     * Call when the charge is updated in Stripe, so we can save fee information in the payment
     */
    static async updateChargeInfo(model: StripePaymentIntent) {
        const stripe = this.getInstance(model.accountId);

        const intent = await stripe.paymentIntents.retrieve(model.stripeIntentId, {
            expand: ['latest_charge.balance_transaction'],
        });

        console.log(intent);
        if (intent.status === 'succeeded') {
            if (intent.latest_charge !== null && typeof intent.latest_charge !== 'string') {
                const payment = await Payment.getByID(model.paymentId);
                if (payment) {
                    await this.saveChargeInfo(model, intent.latest_charge, payment);
                }
            }
        }
    }

    static async getStatus(payment: Payment, cancel = false, testMode = false): Promise<PaymentStatus> {
        if (testMode && !STAMHOOFD.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
            // Do not query anything
            return payment.status;
        }

        const [model] = await StripePaymentIntent.where({ paymentId: payment.id }, { limit: 1 });

        if (!model) {
            return await this.getStatusFromCheckoutSession(payment, cancel);
        }

        const stripe = this.getInstance(model.accountId);

        let intent = await stripe.paymentIntents.retrieve(model.stripeIntentId, {
            expand: ['latest_charge.balance_transaction'],
        });
        console.log(intent);
        if (intent.status === 'succeeded') {
            if (intent.latest_charge !== null && typeof intent.latest_charge !== 'string') {
                await this.saveChargeInfo(model, intent.latest_charge, payment);
            }
            return PaymentStatus.Succeeded;
        }
        if (intent.status === 'canceled' || intent.status === 'requires_payment_method') {
            // For Bnaconctact/iDEAL the payment status is reverted to requires_payment_method when the user cancels the payment
            // Don't ask me why...
            return PaymentStatus.Failed;
        }

        if (cancel) {
            try {
                // Cancel the intent
                console.log('Cancelling payment intent');
                intent = await stripe.paymentIntents.cancel(model.stripeIntentId);
                console.log('Cancelled payment intent', intent);

                if (intent.status === 'succeeded') {
                    return PaymentStatus.Succeeded;
                }
                if (intent.status === 'canceled' || intent.status === 'requires_payment_method') {
                    return PaymentStatus.Failed;
                }
            }
            catch (e) {
                console.error('Error cancelling payment intent', e);
            }
        }

        if (intent.status === 'processing') {
            return PaymentStatus.Pending;
        }
        return PaymentStatus.Created;
    }

    static async getStatusFromCheckoutSession(payment: Payment, cancel = false): Promise<PaymentStatus> {
        const [model] = await StripeCheckoutSession.where({ paymentId: payment.id }, { limit: 1 });

        if (!model) {
            return PaymentStatus.Failed;
        }

        const stripe = this.getInstance(model.accountId);
        const session = await stripe.checkout.sessions.retrieve(model.stripeSessionId, {
            expand: ['payment_intent.latest_charge.balance_transaction'],
        });

        console.log('session', session);

        if (session.payment_status === 'paid') {
            // This is a direct charge
            const payment_intent = session.payment_intent;
            if (payment_intent !== null && typeof payment_intent !== 'string') {
                const charge = payment_intent.latest_charge;
                if (charge !== null && typeof charge !== 'string') {
                    await this.saveChargeInfo(model, charge, payment);
                }
            }
            return PaymentStatus.Succeeded;
        }
        if (session.status === 'expired') {
            return PaymentStatus.Failed;
        }

        if (cancel) {
            // Cancel the session
            const session = await stripe.checkout.sessions.expire(model.stripeSessionId);

            if (session.payment_status === 'paid') {
                return PaymentStatus.Succeeded;
            }
            if (session.status === 'expired') {
                return PaymentStatus.Failed;
            }
        }

        if (session.status === 'complete') {
            // Small difference to detect if the payment is almost done
            return PaymentStatus.Pending;
        }

        return PaymentStatus.Created;
    }

    static async createPayment(
        { payment, stripeAccount, redirectUrl, cancelUrl, customer, statementDescriptor, i18n, metadata, organization, lineItems }: {
            payment: Payment;
            stripeAccount: StripeAccount | null;
            redirectUrl: string;
            cancelUrl: string;
            customer: {
                name: string;
                email: string;
            };
            statementDescriptor: string;
            i18n: I18n;
            metadata: { [key: string]: string };
            organization: Organization;
            lineItems: (BalanceItemPayment & { balanceItem: BalanceItem })[];
        },
    ): Promise<{ paymentUrl: string }> {
        if (!stripeAccount) {
            throw new SimpleError({
                code: '',
                message: $t(`b77e1f68-8928-42a2-802b-059fa73bedc3`, { method: PaymentMethodHelper.getName(payment.method) }),
            });
        }

        const totalPrice = Math.round(payment.price / 100); // Convert from 4 decimal places to 2 decimal places

        if (totalPrice < 50) {
            throw new SimpleError({
                code: 'minimum_amount',
                message: 'The minimum amount for an online payment is € 0,50',
                human: $t(`dae9058f-0aa7-4fcb-9f1d-fc918c65784b`),
            });
        }

        let fee = 0;
        let directCharge = false;
        const vat = calculateVATPercentage(organization.address, organization.meta.VATNumber);
        function calculateFee(fixed: number, percentageTimes100: number) {
            return Math.round(Math.round(fixed + Math.max(1, totalPrice * percentageTimes100 / 100 / 100)) * (100 + vat) / 100); // € 0,21 + 0,2%
        }

        if (payment.method === PaymentMethod.iDEAL) {
            fee = calculateFee(21, 20); // € 0,21 + 0,2%
        }
        else if (payment.method === PaymentMethod.Bancontact) {
            fee = calculateFee(24, 20); // € 0,24 + 0,2%
        }
        else {
            fee = calculateFee(25, 150); // € 0,25 + 1,5%
        }

        if (stripeAccount.meta.type === 'standard') {
            // Submerchant is charged by Stripe for the fees directly
            fee = 0;
            directCharge = true;
        }

        payment.transferFee = fee * 100; // Convert back to 4 decimal places for storage
        const serviceFee = Math.round(payment.serviceFeePayout / 100);

        const fullMetadata = {
            ...(metadata ?? {}),
            organizationVATNumber: organization.meta.VATNumber,
            transactionFee: fee,
            serviceFee: serviceFee, // For historic reasons, this is stored in cents
        };

        const stripe = StripeHelper.getInstance(directCharge ? stripeAccount.accountId : null);
        let paymentUrl: string;

        // Bancontact or iDEAL: use payment intends
        if (payment.method === PaymentMethod.Bancontact || payment.method === PaymentMethod.iDEAL) {
            const paymentMethod = await stripe.paymentMethods.create({
                type: payment.method.toLowerCase() as 'bancontact' | 'ideal',
                billing_details: {
                    name: payment.customer?.dynamicName || (customer.name.length > 2 ? customer.name : $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`)),
                    email: payment.customer?.dynamicEmail || customer.email,
                    address: payment.customer?.company?.address
                        ? {
                                city: payment.customer.company.address.city,
                                country: payment.customer.company.address.country,
                                line1: payment.customer.company.address.street + ' ' + payment.customer.company.address.number,
                                postal_code: payment.customer.company.address.postalCode,
                            }
                        : undefined,
                },
            });

            const paymentIntent = await stripe.paymentIntents.create({
                amount: totalPrice,
                currency: 'eur',
                payment_method: paymentMethod.id,
                payment_method_types: [payment.method.toLowerCase()],
                statement_descriptor: Formatter.slug(statementDescriptor).substring(0, 22).toUpperCase(),
                application_fee_amount: fee + serviceFee,
                on_behalf_of: !directCharge ? stripeAccount.accountId : undefined,
                confirm: true,
                return_url: redirectUrl,
                transfer_data: !directCharge
                    ? {
                            destination: stripeAccount.accountId,
                        }
                    : undefined,
                metadata: fullMetadata,
                payment_method_options: { bancontact: { preferred_language: ['nl', 'fr', 'de', 'en'].includes(i18n.language) ? i18n.language as 'en' : 'nl' } },
            });

            console.log('Stripe payment intent', paymentIntent);
            const url = paymentIntent.next_action?.redirect_to_url?.url;

            if (paymentIntent.status !== 'requires_action' || !url) {
                console.error('Stripe payment intent status is not requires_action', paymentIntent);
                throw new SimpleError({
                    code: 'invalid_status',
                    message: $t(`55d699ae-3da4-45ca-a30e-0f194b08edf7`) + ' ' + PaymentMethodHelper.getName(payment.method) + ' ' + $t(`277dc49e-922a-444f-ba2b-b3442d855358`),
                });
            }

            paymentUrl = url;

            // Store in database
            const paymentIntentModel = new StripePaymentIntent();
            paymentIntentModel.paymentId = payment.id;
            paymentIntentModel.stripeIntentId = paymentIntent.id;
            paymentIntentModel.organizationId = organization.id;

            if (directCharge) {
                paymentIntentModel.accountId = stripeAccount.accountId;
            }
            await paymentIntentModel.save();
        }
        else {
            // Use checkout flow
            const data: Stripe.Checkout.SessionCreateParams = {
                mode: 'payment',
                success_url: redirectUrl,
                cancel_url: cancelUrl,
                payment_method_types: payment.method === PaymentMethod.DirectDebit ? ['sepa_debit'] : ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'eur',
                            unit_amount: totalPrice,
                            product_data: {
                                name: statementDescriptor,
                            },
                        },
                        quantity: 1,
                    },
                ],
                currency: 'eur',
                locale: i18n.language as 'nl',
                payment_intent_data: {
                    on_behalf_of: !directCharge ? stripeAccount.accountId : undefined,
                    application_fee_amount: fee + serviceFee,
                    transfer_data: !directCharge
                        ? {
                                destination: stripeAccount.accountId,
                            }
                        : undefined,
                    metadata: fullMetadata,
                    statement_descriptor: Formatter.slug(statementDescriptor).substring(0, 22).toUpperCase(),

                },
                customer_email: payment.customer?.dynamicEmail || customer.email,
                customer_creation: 'if_required',
                metadata: fullMetadata,
                expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // Expire in 30 minutes
                payment_method_options: {
                    card: {
                        request_three_d_secure: 'challenge', // Force usage of string customer authentication for card payments
                    },
                },
            };
            console.log('Creating Stripe session', data);
            const session = await stripe.checkout.sessions.create(data);
            console.log('Stripe session', session);

            if (!session.url) {
                console.error('Stripe session has no url', session);
                throw new SimpleError({
                    code: 'invalid_status',
                    message: $t(`55d699ae-3da4-45ca-a30e-0f194b08edf7`) + ' ' + PaymentMethodHelper.getName(payment.method) + ' ' + $t(`277dc49e-922a-444f-ba2b-b3442d855358`),
                });
            }
            paymentUrl = session.url;

            // Store in database
            const paymentIntentModel = new StripeCheckoutSession();
            paymentIntentModel.paymentId = payment.id;
            paymentIntentModel.stripeSessionId = session.id;
            paymentIntentModel.organizationId = organization.id;

            if (directCharge) {
                paymentIntentModel.accountId = stripeAccount.accountId;
            }
            await paymentIntentModel.save();
        }

        await payment.save();

        return {
            paymentUrl,
        };
    }
}
