import createMollieClient, { PaymentStatus as MolliePaymentStatus } from '@mollie/api-client';
import { BalanceItem, BalanceItemPayment, MolliePayment, MollieToken, Organization, PayconiqPayment, Payment } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { AuditLogSource, BalanceItemRelation, BalanceItemStatus, BalanceItemType, PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { BuckarooHelper } from '../helpers/BuckarooHelper.js';
import { StripeHelper } from '../helpers/StripeHelper.js';
import { AuditLogService } from './AuditLogService.js';
import { BalanceItemPaymentService } from './BalanceItemPaymentService.js';
import { BalanceItemService } from './BalanceItemService.js';

export const PaymentService = {
    async handlePaymentStatusUpdate(payment: Payment, organization: Organization, status: PaymentStatus) {
        if (payment.status === status) {
            return;
        }

        await AuditLogService.setContext({ fallbackUserId: payment.payingUserId, source: AuditLogSource.Payment, fallbackOrganizationId: payment.organizationId }, async () => {
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
                        await BalanceItemPaymentService.markPaid(balanceItemPayment, organization);
                    }

                    await BalanceItemService.updatePaidAndPending(balanceItemPayments.map(p => p.balanceItem));
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
                        await BalanceItemPaymentService.undoPaid(balanceItemPayment, organization);
                    }

                    await BalanceItemService.updatePaidAndPending(balanceItemPayments.map(p => p.balanceItem));
                });
            }

            // Moved to failed
            if (status == PaymentStatus.Failed) {
                await QueueHandler.schedule('balance-item-update/' + organization.id, async () => {
                    const balanceItemPayments = await BalanceItemPayment.balanceItem.load(
                        (await BalanceItemPayment.where({ paymentId: payment.id })).map(r => r.setRelation(BalanceItemPayment.payment, payment)),
                    );

                    for (const balanceItemPayment of balanceItemPayments) {
                        await BalanceItemPaymentService.markFailed(balanceItemPayment, organization);
                    }

                    await BalanceItemService.updatePaidAndPending(balanceItemPayments.map(p => p.balanceItem));
                });
            }

            // If OLD status was FAILED, we need to revert the actions
            if (oldStatus === PaymentStatus.Failed) { // OLD FAILED!! -> NOW PENDING
                await QueueHandler.schedule('balance-item-update/' + organization.id, async () => {
                    const balanceItemPayments = await BalanceItemPayment.balanceItem.load(
                        (await BalanceItemPayment.where({ paymentId: payment.id })).map(r => r.setRelation(BalanceItemPayment.payment, payment)),
                    );

                    for (const balanceItemPayment of balanceItemPayments) {
                        await BalanceItemPaymentService.undoFailed(balanceItemPayment, organization);
                    }

                    await BalanceItemService.updatePaidAndPending(balanceItemPayments.map(p => p.balanceItem));
                });
            }
        });
    },

    /**
     * ID of payment is needed because of race conditions (need to fetch payment in a race condition save queue)
     */
    async pollStatus(paymentId: string, org: Organization | null, cancel = false): Promise<Payment | undefined> {
        // Prevent polling the same payment multiple times at the same time: create a queue to prevent races
        return await QueueHandler.schedule('payments/' + paymentId, async () => {
            // Get a new copy of the payment (is required to prevent concurreny bugs)
            const payment = await Payment.getByID(paymentId);
            if (!payment) {
                return;
            }

            // Explicitly set userId to null, because all actions caused by a poll are not caused by the currently signed in user, but the paying user id
            return await AuditLogService.setContext({ userId: payment.payingUserId ?? null, source: AuditLogSource.Payment }, async () => {
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

                if (payment.status === PaymentStatus.Pending || payment.status === PaymentStatus.Created || (payment.provider === PaymentProvider.Buckaroo && payment.status === PaymentStatus.Failed)) {
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
                                    let mollieData = await mollieClient.payments.get(molliePayment.mollieId, {
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
                                    else if ((cancel || this.shouldTryToCancel(payment.status, payment)) && mollieData.isCancelable) {
                                        console.log('Cancelling Mollie payment on request', payment.id);
                                        mollieData = await mollieClient.payments.cancel(molliePayment.mollieId);

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

                            let status = await payconiqPayment.getStatus(organization, payment);

                            if (!cancel && this.shouldTryToCancel(status, payment)) {
                                console.error('Manually cancelling Payconiq payment', payment.id);
                                if (await payconiqPayment.cancel(organization)) {
                                    status = PaymentStatus.Failed;
                                }
                                else {
                                    console.error('Failed to manually cancel payment');
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
        });
    },

    isManualExpired(status: PaymentStatus, payment: Payment) {
        if ((status == PaymentStatus.Pending || status === PaymentStatus.Created) && payment.method !== PaymentMethod.DirectDebit) {
            // If payment is not succeeded after one day, mark as failed
            if (payment.createdAt < new Date(new Date().getTime() - 60 * 1000 * 60 * 24)) {
                return true;
            }
        }
        return false;
    },

    /**
     * Try to cancel a payment that is still pending
     */
    shouldTryToCancel(status: PaymentStatus, payment: Payment): boolean {
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
    },

    /**
     * Say the total amount to pay is 15,238 because (e.g. because of VAT). In that case,
     * we'll need to round the payment to 1 cent. That can cause issues in the financial statements because
     * the total amount of balances does not match the total amount received/paid.
     *
     * To fix that, we create an extra balance item with the difference. So the rounding always matches.
     *
     * TODO: update this method to generate a virtual invoice and use the price of the invoice instead of the rounded payment price, so we don't get differences in calculation
     */
    async round(payment: Payment) {
        const amount = payment.price;
        const rounded = Payment.roundPrice(payment.price);
        const difference = rounded - amount;

        if (difference === 0) {
            return;
        }

        if (difference > 100 || difference < -100) {
            throw new Error('Unexpected rounding difference of ' + difference + ' for payment ' + payment.id);
        }

        // payment.roundingAmount = difference;

        // Change payment total price
        payment.price += difference;
        await payment.save();
    },
};
