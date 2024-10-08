import { createMollieClient, PaymentStatus as MolliePaymentStatus } from '@mollie/api-client';
import { AutoEncoder, BooleanDecoder, Decoder, field } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, BalanceItemPayment, MolliePayment, MollieToken, Organization, PayconiqPayment, Payment } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentGeneral, PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { BuckarooHelper } from '../../../helpers/BuckarooHelper';
import { Context } from '../../../helpers/Context';
import { StripeHelper } from '../../../helpers/StripeHelper';

type Params = { id: string };
class Query extends AutoEncoder {
    @field({ decoder: BooleanDecoder, optional: true })
    exchange = false;

    /**
     * If possible, cancel the payment if it is not yet paid/pending
     */
    @field({ decoder: BooleanDecoder, optional: true })
    cancel = false;
}
type Body = undefined;
type ResponseBody = PaymentGeneral | undefined;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class ExchangePaymentEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/payments/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        if (!request.query.exchange) {
            await Context.authenticate();
        }

        // Not method on payment because circular references (not supprted in ts)
        const payment = await ExchangePaymentEndpoint.pollStatus(request.params.id, organization, request.query.cancel);
        if (!payment) {
            throw new SimpleError({
                code: '',
                message: 'Deze link is ongeldig',
            });
        }

        if (request.query.exchange) {
            return new Response(undefined);
        }

        return new Response(
            await AuthenticatedStructures.paymentGeneral(payment, true),
        );
    }

    static async handlePaymentStatusUpdate(payment: Payment, organization: Organization, status: PaymentStatus) {
        if (payment.status === status) {
            return;
        }

        if (status === PaymentStatus.Succeeded) {
            payment.status = PaymentStatus.Succeeded;
            payment.paidAt = new Date();
            await payment.save();

            // Prevent concurrency issues
            await QueueHandler.schedule('balance-item-update/' + organization.id, async () => {
                const unloaded = (await BalanceItemPayment.where({ paymentId: payment.id })).map(r => r.setRelation(BalanceItemPayment.payment, payment));
                const balanceItemPayments = await BalanceItemPayment.balanceItem.load(
                    unloaded,
                );

                for (const balanceItemPayment of balanceItemPayments) {
                    await balanceItemPayment.markPaid(organization);
                }

                await BalanceItem.updateOutstanding(balanceItemPayments.map(p => p.balanceItem));
            });
            return;
        }

        const oldStatus = payment.status;

        // Save before updating balance items
        payment.status = status;
        payment.paidAt = null;
        await payment.save();

        // If OLD status was succeeded, we need to revert the actions
        if (oldStatus === PaymentStatus.Succeeded) {
            // No longer succeeded
            await QueueHandler.schedule('balance-item-update/' + organization.id, async () => {
                const balanceItemPayments = await BalanceItemPayment.balanceItem.load(
                    (await BalanceItemPayment.where({ paymentId: payment.id })).map(r => r.setRelation(BalanceItemPayment.payment, payment)),
                );

                for (const balanceItemPayment of balanceItemPayments) {
                    await balanceItemPayment.undoPaid(organization);
                }

                await BalanceItem.updateOutstanding(balanceItemPayments.map(p => p.balanceItem));
            });
        }

        // Moved to failed
        if (status == PaymentStatus.Failed) {
            await QueueHandler.schedule('balance-item-update/' + organization.id, async () => {
                const balanceItemPayments = await BalanceItemPayment.balanceItem.load(
                    (await BalanceItemPayment.where({ paymentId: payment.id })).map(r => r.setRelation(BalanceItemPayment.payment, payment)),
                );

                for (const balanceItemPayment of balanceItemPayments) {
                    await balanceItemPayment.markFailed(organization);
                }

                await BalanceItem.updateOutstanding(balanceItemPayments.map(p => p.balanceItem));
            });
        }

        // If OLD status was FAILED, we need to revert the actions
        if (oldStatus === PaymentStatus.Failed) { // OLD FAILED!! -> NOW PENDING
            await QueueHandler.schedule('balance-item-update/' + organization.id, async () => {
                const balanceItemPayments = await BalanceItemPayment.balanceItem.load(
                    (await BalanceItemPayment.where({ paymentId: payment.id })).map(r => r.setRelation(BalanceItemPayment.payment, payment)),
                );

                for (const balanceItemPayment of balanceItemPayments) {
                    await balanceItemPayment.undoFailed(organization);
                }

                await BalanceItem.updateOutstanding(balanceItemPayments.map(p => p.balanceItem));
            });
        }
    }

    /**
     * ID of payment is needed because of race conditions (need to fetch payment in a race condition save queue)
     */
    static async pollStatus(paymentId: string, org: Organization | null, cancel = false): Promise<Payment | undefined> {
        // Prevent polling the same payment multiple times at the same time: create a queue to prevent races
        QueueHandler.cancel('payments/' + paymentId); // Prevent creating more than one queue item for the same payment
        return await QueueHandler.schedule('payments/' + paymentId, async () => {
            // Get a new copy of the payment (is required to prevent concurreny bugs)
            const payment = await Payment.getByID(paymentId);
            if (!payment) {
                return;
            }

            if (!payment.organizationId) {
                console.error('Payment without organization not supported', payment.id);
                return;
            }

            const organization = org ?? await Organization.getByID(payment.organizationId);
            if (!organization) {
                console.error('Organization not found for payment', payment.id);
                return;
            }

            const testMode = organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production';

            if (payment.status == PaymentStatus.Pending || payment.status == PaymentStatus.Created || (payment.provider === PaymentProvider.Buckaroo && payment.status == PaymentStatus.Failed)) {
                if (payment.provider === PaymentProvider.Stripe) {
                    try {
                        let status = await StripeHelper.getStatus(payment, cancel || this.shouldTryToCancel(payment.status, payment), testMode);

                        if (this.isManualExpired(status, payment)) {
                            console.error('Manually marking Stripe payment as expired', payment.id);
                            status = PaymentStatus.Failed;
                        }

                        await this.handlePaymentStatusUpdate(payment, organization, status);
                    }
                    catch (e) {
                        console.error('Payment check failed Stripe', payment.id, e);
                        if (this.isManualExpired(payment.status, payment)) {
                            console.error('Manually marking Stripe payment as expired', payment.id);
                            await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                        }
                    }
                }
                else if (payment.provider === PaymentProvider.Mollie) {
                    // check status via mollie
                    const molliePayments = await MolliePayment.where({ paymentId: payment.id }, { limit: 1 });
                    if (molliePayments.length == 1) {
                        const molliePayment = molliePayments[0];
                        // check status
                        const token = await MollieToken.getTokenFor(organization.id);

                        if (token) {
                            try {
                                const mollieClient = createMollieClient({ accessToken: await token.getAccessToken() });
                                const mollieData = await mollieClient.payments.get(molliePayment.mollieId, {
                                    testmode: organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production',
                                });

                                console.log(mollieData); // log to log files to check issues

                                const details = mollieData.details as any;
                                if (details?.consumerName) {
                                    payment.ibanName = details.consumerName;
                                }
                                if (details?.consumerAccount) {
                                    payment.iban = details.consumerAccount;
                                }
                                if (details?.cardHolder) {
                                    payment.ibanName = details.cardHolder;
                                }
                                if (details?.cardNumber) {
                                    payment.iban = 'xxxx xxxx xxxx ' + details.cardNumber;
                                }

                                if (mollieData.status === MolliePaymentStatus.paid) {
                                    await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Succeeded);
                                }
                                else if (mollieData.status === MolliePaymentStatus.failed || mollieData.status === MolliePaymentStatus.expired || mollieData.status === MolliePaymentStatus.canceled) {
                                    await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                                }
                                else if (this.isManualExpired(payment.status, payment)) {
                                    // Mollie still returning pending after 1 day: mark as failed
                                    console.error('Manually marking Mollie payment as expired', payment.id);
                                    await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                                }
                            }
                            catch (e) {
                                console.error('Payment check failed Mollie', payment.id, e);
                                if (this.isManualExpired(payment.status, payment)) {
                                    console.error('Manually marking Mollie payment as expired', payment.id);
                                    await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                                }
                            }
                        }
                        else {
                            console.warn('Mollie payment is missing for organization ' + organization.id + ' while checking payment status...');

                            if (this.isManualExpired(payment.status, payment)) {
                                console.error('Manually marking payment without mollie token as expired', payment.id);
                                await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                            }
                        }
                    }
                    else {
                        if (this.isManualExpired(payment.status, payment)) {
                            console.error('Manually marking payment without mollie payments as expired', payment.id);
                            await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                        }
                    }
                }
                else if (payment.provider == PaymentProvider.Buckaroo) {
                    const helper = new BuckarooHelper(organization.privateMeta.buckarooSettings?.key ?? '', organization.privateMeta.buckarooSettings?.secret ?? '', organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production');
                    try {
                        let status = await helper.getStatus(payment);

                        if (this.isManualExpired(status, payment)) {
                            console.error('Manually marking Buckaroo payment as expired', payment.id);
                            status = PaymentStatus.Failed;
                        }

                        await this.handlePaymentStatusUpdate(payment, organization, status);
                    }
                    catch (e) {
                        console.error('Payment check failed Buckaroo', payment.id, e);
                        if (this.isManualExpired(payment.status, payment)) {
                            console.error('Manually marking Buckaroo payment as expired', payment.id);
                            await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                        }
                    }
                }
                else if (payment.provider == PaymentProvider.Payconiq) {
                    // Check status

                    const payconiqPayments = await PayconiqPayment.where({ paymentId: payment.id }, { limit: 1 });
                    if (payconiqPayments.length == 1) {
                        const payconiqPayment = payconiqPayments[0];

                        if (cancel) {
                            console.error('Cancelling Payconiq payment on request', payment.id);
                            await payconiqPayment.cancel(organization);
                        }

                        let status = await payconiqPayment.getStatus(organization);

                        if (!cancel && this.shouldTryToCancel(status, payment)) {
                            console.error('Manually cancelling Payconiq payment', payment.id);
                            if (await payconiqPayment.cancel(organization)) {
                                status = PaymentStatus.Failed;
                            }
                        }

                        if (this.isManualExpired(status, payment)) {
                            console.error('Manually marking Payconiq payment as expired', payment.id);
                            status = PaymentStatus.Failed;
                        }

                        await this.handlePaymentStatusUpdate(payment, organization, status);
                    }
                    else {
                        console.warn('Payconiq payment is missing for organization ' + organization.id + ' while checking payment status...');

                        if (this.isManualExpired(payment.status, payment)) {
                            console.error('Manually marking Payconiq payment as expired because not found', payment.id);
                            await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                        }
                    }
                }
                else {
                    console.error('Invalid payment provider', payment.provider, 'for payment', payment.id);
                    if (this.isManualExpired(payment.status, payment)) {
                        console.error('Manually marking unknown payment as expired', payment.id);
                        await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                    }
                }
            }
            else {
                // Do a manual update if needed
                if (payment.status === PaymentStatus.Succeeded) {
                    if (payment.provider === PaymentProvider.Stripe) {
                        // Update the status
                        await StripeHelper.getStatus(payment, false, testMode);
                    }
                }
            }
            return payment;
        });
    }

    static isManualExpired(status: PaymentStatus, payment: Payment) {
        if ((status == PaymentStatus.Pending || status === PaymentStatus.Created) && payment.method !== PaymentMethod.DirectDebit) {
            // If payment is not succeeded after one day, mark as failed
            if (payment.createdAt < new Date(new Date().getTime() - 60 * 1000 * 60 * 24)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Try to cancel a payment that is still pending
     */
    static shouldTryToCancel(status: PaymentStatus, payment: Payment) {
        if ((status == PaymentStatus.Pending || status === PaymentStatus.Created) && payment.method !== PaymentMethod.DirectDebit) {
            let timeout = STAMHOOFD.environment === 'development' ? 60 * 1000 * 2 : 60 * 1000 * 30;

            // If payconiq and not yet 'identified' (scanned), cancel after 5 minutes
            if (payment.provider === PaymentProvider.Payconiq && status === PaymentStatus.Created) {
                timeout = STAMHOOFD.environment === 'development' ? 60 * 1000 * 1 : 60 * 1000 * 5;
            }

            if (payment.createdAt < new Date(new Date().getTime() - timeout)) {
                return true;
            }
        }
        return false;
    }
}
