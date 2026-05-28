import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import type { Member, User } from '@stamhoofd/models';
import { BalanceItem, BalanceItemPayment, Group, Organization, PayconiqPayment, Payment, Platform, sendEmailTemplate, UsedRegisterCode } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import type { Checkoutable, PaymentConfiguration, PrivatePaymentConfiguration } from '@stamhoofd/structures';
import { AuditLogSource, BalanceItemPaymentDetailed, BalanceItemType, EmailTemplateType, Invoice, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus, PaymentType, Recipient, Replacement, VATExcemptReason, Version } from '@stamhoofd/structures';
import type { CreateMandateSettings } from '@stamhoofd/structures/checkout/CreateMandateSettings.js';
import type { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { PaymentMandateStatus, PaymentMandateType } from '@stamhoofd/structures/PaymentMandate.js';
import { Formatter } from '@stamhoofd/utility';
import { buildReplacementOptions, getEmailReplacementsForPayment } from '../email-replacements/getEmailReplacementsForPayment.js';
import { BuckarooHelper } from '../helpers/BuckarooHelper.js';
import { Context } from '../helpers/Context.js';
import { ServiceFeeHelper } from '../helpers/ServiceFeeHelper.js';
import { StripeHelper } from '../helpers/StripeHelper.js';
import { ViesHelper } from '../helpers/ViesHelper.js';
import { AuditLogService } from './AuditLogService.js';
import { BalanceItemPaymentService } from './BalanceItemPaymentService.js';
import { BalanceItemService } from './BalanceItemService.js';
import { MollieService } from './MollieService.js';
import { PaymentMandateService } from './PaymentMandateService.js';
import { ReferralService } from './ReferralService.js';
import { VATService } from './VATService.js';

export class PaymentService {
    static async updateReversedPaymentsFor(payment: Payment) {
        if (payment.reversingPaymentId) {
            // Update refund amount of that payment
            const reversingPayment = await Payment.getByID(payment.reversingPaymentId);
            if (reversingPayment) {
                await reversingPayment.updateRefundedAmount();
            }
        }
    }

    static async handlePaymentStatusUpdate(payment: Payment, organization: Organization, status: PaymentStatus, paidAt?: Date) {
        if (payment.status === status) {
            return;
        }

        if (status === PaymentStatus.Failed && payment.invoiceId) {
            throw new SimpleError({
                code: 'cannot_fail',
                message: 'A payment that has been invoiced cannot be marked as failed. Instead create a separate chargeback payment with a negative amount.',
                human: $t('%1RI'),
            });
        }

        if (organization.id !== payment.organizationId) {
            throw new Error('Unexpected organization, expected ' + payment.organizationId + ', received ' + organization.id);
        }

        await AuditLogService.setContext({ fallbackUserId: payment.payingUserId, source: AuditLogSource.Payment, fallbackOrganizationId: payment.organizationId }, async () => {
            if (status === PaymentStatus.Succeeded) {
                console.log('Marking as succeeded', payment.id);
                payment.status = PaymentStatus.Succeeded;
                payment.paidAt = paidAt ?? new Date();
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

                    // Flush caches so data is up to date in response
                    await BalanceItemService.flushCaches(organization.id);

                    await this.updateReversedPaymentsFor(payment);
                });

                if (payment.price >= 100_00 && payment.organizationId && payment.payingOrganizationId && payment.organizationId === ((await Platform.getShared()).membershipOrganizationId)) {
                    // We spend some money
                    const code = await UsedRegisterCode.getFor(payment.payingOrganizationId);
                    if (code && !code.balanceItemId) {
                        console.log('Rewarding code ' + code.id + ' for payment');

                        // Deze code werd nog niet beloond
                        await ReferralService.reward(code);
                    }
                }

                // It is possible the mandate succeeds immediately, in which case we might
                // need to save it as the default payment method
                await this.saveMandateIfNeeded({
                    payment,
                    sellingOrganizationId: organization.id,
                });

                if (payment.type === PaymentType.Chargeback) {
                    await this.handleChargebackCreated(payment, organization);
                }
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

                    // Flush caches so data is up to date in response
                    await BalanceItemService.flushCaches(organization.id);

                    await this.updateReversedPaymentsFor(payment);
                });
            }

            // Moved to failed
            if (status === PaymentStatus.Failed) {
                console.log('Marking as failed', payment.id);
                await QueueHandler.schedule('balance-item-update/' + organization.id, async () => {
                    const balanceItemPayments = await BalanceItemPayment.balanceItem.load(
                        (await BalanceItemPayment.where({ paymentId: payment.id })).map(r => r.setRelation(BalanceItemPayment.payment, payment)),
                    );

                    for (const balanceItemPayment of balanceItemPayments) {
                        await BalanceItemPaymentService.markFailed(balanceItemPayment, organization);
                    }

                    await BalanceItemService.updatePaidAndPending(balanceItemPayments.map(p => p.balanceItem));

                    // Flush caches so data is up to date in response
                    await BalanceItemService.flushCaches(organization.id);
                });

                if (payment.type === PaymentType.Payment) {
                    await this.handlePaymentFailed(payment, organization);
                }
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

                    // Flush caches so data is up to date in response
                    await BalanceItemService.flushCaches(organization.id);
                });
            }
        });
    }

    private static async handleChargebackCreated(payment: Payment, organization: Organization) {
        if (!payment.payingOrganizationId) {
            // For now only for B2B
            return;
        }

        const payingOrganization = await Organization.getByID(payment.payingOrganizationId, true);

        await sendEmailTemplate(organization, {
            recipients: await payingOrganization.getFinanceAdminRecipients(),
            defaultReplacements: [
                Replacement.create({
                    token: 'payingOrganizationName',
                    value: payingOrganization.name,
                }),
                Replacement.create({
                    token: 'paymentUrl',
                    value: 'https://' + payingOrganization.getDashboardHost() + '/boekhouding/openstaand/' + organization.uri,
                }),
            ],
            template: {
                type: EmailTemplateType.ChargebackPayingOrganization,
            },
            type: 'transactional',
        });
    }

    private static async handlePaymentFailed(payment: Payment, organization: Organization) {
        if (!payment.payingOrganizationId) {
            // For now only for B2B
            return;
        }

        if (!((payment.adminUserId && payment.mandateId) || (payment.method === PaymentMethod.DirectDebit && payment.mandateId))) {
            return;
        }

        const payingOrganization = await Organization.getByID(payment.payingOrganizationId, true);

        await sendEmailTemplate(organization, {
            recipients: await payingOrganization.getFinanceAdminRecipients(),
            defaultReplacements: [
                Replacement.create({
                    token: 'payingOrganizationName',
                    value: payingOrganization.name,
                }),
                Replacement.create({
                    token: 'paymentUrl',
                    value: 'https://' + payingOrganization.getDashboardHost() + '/boekhouding/openstaand/' + organization.uri,
                }),
            ],
            template: {
                type: EmailTemplateType.AutomaticChargeFailedPayingOrganization,
            },
            type: 'transactional',
        });
    }

    static async saveMandateIfNeeded({ payment, sellingOrganizationId }: { payment: Payment; sellingOrganizationId: string }) {
        // Save as default
        if (payment.createMandate && payment.createMandate.saveAsDefault) {
            if (payment.mandateId && payment.status === PaymentStatus.Succeeded) {
                try {
                    await PaymentMandateService.setDefaultMandate({
                        mandateId: payment.mandateId,
                        payingOrganizationId: payment.payingOrganizationId,
                        sellingOrganizationId,
                        payingUserId: payment.payingUserId,
                    });
                } catch (e) {
                    // Ignore as setting the payment status is more important
                    console.error(e);
                }
            }
        }
    }

    /**
     * ID of payment is needed because of race conditions (need to fetch payment in a race condition save queue)
     */
    static async pollStatus(paymentId: string, org: Organization | null, cancel = false): Promise<Payment | undefined> {
        // Prevent polling the same payment multiple times at the same time: create a queue to prevent races
        return await QueueHandler.schedule('payments/' + paymentId, async () => {
            // Get a new copy of the payment (is required to prevent concurreny bugs)
            const payment = await Payment.getByID(paymentId);
            if (!payment) {
                return;
            }

            if (org && payment.organizationId !== org.id && org.id !== payment.payingOrganizationId) {
                console.error('Non-matching organization found for payment', payment.id, 'org', org.id);
                return;
            }

            // Explicitly set userId to null, because all actions caused by a poll are not caused by the currently signed in user, but the paying user id
            return await AuditLogService.setContext({ userId: payment.payingUserId ?? null, source: AuditLogSource.Payment }, async () => {
                if (!payment.organizationId) {
                    console.error('Payment without organization not supported', payment.id);
                    return;
                }

                const organization = org && org.id === payment.organizationId ? org : await Organization.getByID(payment.organizationId);
                if (!organization) {
                    console.error('Organization not found for payment', payment.id);
                    return;
                }
                if (org && org.id !== payment.organizationId && org.id !== payment.payingOrganizationId) {
                    console.error('Non-matching organization found for payment', payment.id, 'org', org.id);
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

                            console.log('Stripe setting status to', status);
                            await this.handlePaymentStatusUpdate(payment, organization, status);
                        } catch (e) {
                            console.error('Payment check failed Stripe', payment.id, e);
                            if (this.isManualExpired(payment.status, payment)) {
                                console.error('Manually marking Stripe payment as expired', payment.id);
                                await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                            }
                        }
                    } else if (payment.provider === PaymentProvider.Mollie) {
                        try {
                            const mollieClient = await MollieService.create({
                                sellingOrganization: organization,
                            });
                            if (mollieClient) {
                                let { status } = await mollieClient.getStatus(payment, cancel || this.shouldTryToCancel(payment.status, payment));

                                if (this.isManualExpired(status, payment)) {
                                    console.error('Manually marking Mollie payment as expired', payment.id);
                                    status = PaymentStatus.Failed;
                                }

                                console.log('Mollie setting status to', status);
                                await this.handlePaymentStatusUpdate(payment, organization, status);
                            } else {
                                console.error('Missing Mollie Credentials for payment', payment.id);
                                if (this.isManualExpired(payment.status, payment)) {
                                    console.error('Manually marking Mollie payment as expired', payment.id);
                                    await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                                }
                            }
                        } catch (e) {
                            console.error('Payment check failed Mollie', payment.id, e);
                            if (this.isManualExpired(payment.status, payment)) {
                                console.error('Manually marking Mollie payment as expired', payment.id);
                                await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                            }
                        }
                    } else if (payment.provider === PaymentProvider.Buckaroo) {
                        const helper = new BuckarooHelper(organization.privateMeta.buckarooSettings?.key ?? '', organization.privateMeta.buckarooSettings?.secret ?? '', testMode);
                        try {
                            let status = await helper.getStatus(payment);

                            if (this.isManualExpired(status, payment)) {
                                console.error('Manually marking Buckaroo payment as expired', payment.id);
                                status = PaymentStatus.Failed;
                            }

                            console.log('Buckaroo setting status to', status);
                            await this.handlePaymentStatusUpdate(payment, organization, status);
                        } catch (e) {
                            console.error('Payment check failed Buckaroo', payment.id, e);
                            if (this.isManualExpired(payment.status, payment)) {
                                console.error('Manually marking Buckaroo payment as expired', payment.id);
                                await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                            }
                        }
                    } else if (payment.provider == PaymentProvider.Payconiq) {
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
                                } else {
                                    console.error('Failed to manually cancel payment');
                                }
                            }

                            if (this.isManualExpired(status, payment)) {
                                console.error('Manually marking Payconiq payment as expired', payment.id);
                                status = PaymentStatus.Failed;
                            }

                            await this.handlePaymentStatusUpdate(payment, organization, status);
                        } else {
                            console.warn('Payconiq payment is missing for organization ' + organization.id + ' while checking payment status...');

                            if (this.isManualExpired(payment.status, payment)) {
                                console.error('Manually marking Payconiq payment as expired because not found', payment.id);
                                await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                            }
                        }
                    } else {
                        console.error('Invalid payment provider', payment.provider, 'for payment', payment.id);
                        if (this.isManualExpired(payment.status, payment)) {
                            console.error('Manually marking unknown payment as expired', payment.id);
                            await this.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
                        }
                    }
                } else {
                    // Do a manual update if needed
                    if (payment.status === PaymentStatus.Succeeded) {
                        if ((payment.provider === PaymentProvider.Mollie && STAMHOOFD.environment === 'development')) {
                            // Update the status
                            await StripeHelper.getStatus(payment, false, testMode);
                        }
                    }
                }
                return payment;
            });
        });
    }

    static isManualExpired(status: PaymentStatus, payment: Payment) {
        if ((status === PaymentStatus.Pending || status === PaymentStatus.Created) && payment.method !== PaymentMethod.DirectDebit) {
            // If payment is not succeeded after one day, mark as failed
            if (payment.createdAt < new Date(new Date().getTime() - 60 * 1000 * 60 * 24)) {
                return true;
            }
        }

        if (STAMHOOFD.environment === 'development') {
            // In development, we expire all direct debits and other paymetns after 1 hour, because they need manual changes
            // otherwise they will remain stuck in the dev environment, poluting the UI
            if ((status === PaymentStatus.Pending || status === PaymentStatus.Created)) {
                // If payment is not succeeded after one day, mark as failed
                if (payment.createdAt < new Date(new Date().getTime() - 60 * 1000 * 60)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Try to cancel a payment that is still pending
     */
    static shouldTryToCancel(status: PaymentStatus, payment: Payment): boolean {
        if ((status === PaymentStatus.Pending || status === PaymentStatus.Created) && (payment.method !== PaymentMethod.DirectDebit || STAMHOOFD.environment === 'development')) {
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

    /**
     * Say the total amount to pay is 15,238 because (e.g. because of VAT). In that case,
     * we'll need to round the payment to 1 cent. That can cause issues in the financial statements because
     * the total amount of balances does not match the total amount received/paid.
     *
     * To fix that, we create an extra roundingAmount with the difference. So the rounding always matches.
     */
    static roundPayment(payment: Payment) {
        // Calculate total price of the balance items
        // this fixes issus when the method is called multiple times
        // should be subtracted, not added
        const balanceItemsTotalPrice = payment.price - payment.roundingAmount;

        const { roundingAmount, price } = this.round(balanceItemsTotalPrice);
        payment.roundingAmount = roundingAmount;
        payment.price = price;
    }

    static round(amount: number) {
        const rounded = Payment.roundPrice(amount);
        const difference = rounded - amount;

        if (difference === 0) {
            return {
                price: amount,
                roundingAmount: 0,
            };
        }

        if (difference > 100 || difference < -100) {
            throw new Error('Unexpected rounding difference of ' + difference + ' for price ' + amount.toString());
        }

        return {
            price: amount + difference,
            roundingAmount: difference,
        };
    }

    static calculateTotalPrice({ balanceItems, organization, members }: {
        balanceItems: Map<BalanceItem, number>;
        organization: Organization;
        members?: Member[];
    }) {
        let totalPrice = 0;
        const names: {
            firstName: string;
            lastName: string;
            name: string;
        }[] = [];
        let hasNegative = false;

        for (const [balanceItem, price] of balanceItems) {
            if (organization.id !== balanceItem.organizationId) {
                throw new Error('Unexpected balance item from other organization');
            }

            if (price > 0 && price > Math.max(balanceItem.priceOpen, balanceItem.priceDue - balanceItem.pricePaid)) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: $t(`%vv`),
                });
            }

            if (price < 0 && price < Math.min(balanceItem.priceOpen, balanceItem.priceDue - balanceItem.pricePaid)) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: $t(`%vw`),
                });
            }

            if (price < 0) {
                hasNegative = true;
            }

            totalPrice += price;

            if (price > 0 && balanceItem.memberId && balanceItem.type === BalanceItemType.Registration) {
                const member = members?.find(m => m.id === balanceItem.memberId);
                if (!member) {
                    throw new SimpleError({
                        code: 'invalid_data',
                        message: $t(`%vx`),
                    });
                }
                names.push({
                    firstName: member.firstName,
                    lastName: member.lastName,
                    name: member.details.name,
                });
            }
        }
        const { price, roundingAmount } = this.round(totalPrice);

        if (price < 0) {
            throw new SimpleError({
                code: 'negative_price',
                message: $t(`%vl`),
            });
        }

        return { hasNegative, price, roundingAmount, names };
    }

    static validateTotalPrice({ price, roundingAmount, checkout }: {
        price: number; // already rounded
        roundingAmount: number;
        checkout: Pick<Checkoutable<never>, 'totalPrice'>;
    }) {
        // total price without rounding
        const balanceItemsPrice = price - roundingAmount;

        // also accept rounding that might have happend in the frontend and that was correct
        if (checkout.totalPrice !== null && checkout.totalPrice !== balanceItemsPrice && checkout.totalPrice !== price) {
            throw new SimpleError({
                code: 'changed_price',
                message: $t(`%vk`, { total: Formatter.price(price) }),
            });
        }
    }

    static async validateCustomer({ price, hasNegative, user, checkout, payingOrganization }: {
        price: number;
        hasNegative: boolean;
        user: User | null;
        checkout: Pick<Checkoutable<never>, 'customer'>;
        payingOrganization?: Organization | null;
    }) {
        // Fill in customer default value
        const customer = PaymentCustomer.create({
            firstName: user?.firstName,
            lastName: user?.lastName,
            email: user?.email,
            phone: checkout.customer?.phone,
        });

        // Use structured transfer description prefix
        let prefix = '';

        if (payingOrganization) {
            if (price !== 0 || hasNegative || checkout.customer) {
                if (!checkout.customer) {
                    throw new SimpleError({
                        code: 'missing_fields',
                        message: 'customer is required when paying as an organization',
                        human: $t(`%vz`),
                    });
                }

                if (!checkout.customer.company) {
                    throw new SimpleError({
                        code: 'missing_fields',
                        message: 'customer.company is required when paying as an organization',
                        human: $t(`%w0`),
                    });
                }

                // Search company id
                // this avoids needing to check the VAT number every time
                const id = checkout.customer.company.id;
                const foundCompany = payingOrganization.meta.companies.find(c => c.id === id);

                if (!foundCompany) {
                    throw new SimpleError({
                        code: 'invalid_data',
                        message: $t(`%w1`),
                    });
                }

                if (!checkout.customer.company.equals(foundCompany)) {
                    throw new SimpleError({
                        code: 'invalid_data',
                        message: 'Cannot change company data. Please save the company data to the paying organization meta data before using it.',
                    });
                }

                customer.company = foundCompany;

                const orgNumber = parseInt(payingOrganization.uri);

                if (orgNumber !== 0 && !isNaN(orgNumber)) {
                    prefix = orgNumber + '';
                }
            } else {
                // Zero amount payment (without refunds) without specifying a company will just use the default company to link to the payment
                // It doesn't really matter since the price is zero and we won't invoice it.
                const company = VATService.getDefaultCompanyForOrganization(payingOrganization);
                if (company) {
                    customer.company = company;
                }
            }
        } else {
            if (checkout.customer && checkout.customer.company) {
                customer.company = checkout.customer.company.clone();
                await ViesHelper.checkCompany(checkout.customer.company, customer.company);
            }
        }

        if (price !== 0 && customer.company?.VATNumber !== checkout.customer?.company?.VATNumber) {
            // Security check: because previous validation and generation might have used the VATNumber from the checkout
            throw new SimpleError({
                code: 'changed_VAT_number',
                message: 'Unexpected VAT number change',
            });
        }

        return { customer, prefix };
    }

    static async createProForma({ balanceItems, organization, user, members, checkout, payingOrganization }: {
        balanceItems: Map<BalanceItem, number>;
        organization: Organization;
        user: User;
        members?: Member[];
        checkout: Pick<Checkoutable<never>, 'totalPrice' | 'customer' | 'cancelUrl' | 'redirectUrl'>;
        payingOrganization?: Organization | null;
    }) {
        // Calculate total price to pay
        const { price, hasNegative, roundingAmount } = PaymentService.calculateTotalPrice({ balanceItems, organization, members });
        PaymentService.validateTotalPrice({ price, roundingAmount, checkout });

        const { customer } = await PaymentService.validateCustomer({ user, checkout, payingOrganization, price, hasNegative });
        const { seller } = PaymentService.validateVATRates({ customer, sellingOrganization: organization, balanceItems });

        // Create invoice instead from fictive PaymentGeneral
        const fakePaymentGeneral = PaymentGeneral.create({
            id: 'pro-forma',
            price,
            customer,
            method: PaymentMethod.Unknown,
            balanceItemPayments: [...balanceItems.entries()].map(([balanceItem, price]) => {
                return BalanceItemPaymentDetailed.create({
                    id: 'pro-forma-' + balanceItem.id,
                    balanceItem: balanceItem.getStructure(),
                    price,
                });
            }),
        });

        let invoice: Invoice | null = null;

        try {
            invoice = Invoice.create({
                seller,
                customer,
                payments: [fakePaymentGeneral],
            });
            invoice.buildFromPayments();
        } catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode('balance_item_without_vat_percentage')) {
                // ok
                // Missing VAT that prevents invoice from being created
            } else {
                throw e;
            }
        }

        return {
            invoice,
            payment: fakePaymentGeneral,
        };
    }

    static async registerChargeback(payment: Payment, amount: number, date: Date) {
        if (amount !== payment.price) {
            // Creates issues to know what balance item was paid and what was not.
            throw new Error('Cannot register chargeback with different amount than the payment for payment ' + payment.id);
        }
        const balanceItemPayments = await BalanceItemPayment.select().where('paymentId', payment.id).fetch();
        const items = await BalanceItem.getByIDs(...Formatter.uniqueArray(balanceItemPayments.map(b => b.balanceItemId)));

        // Done validation
        const chargeback = new Payment();

        // Who will receive this money?
        chargeback.organizationId = payment.organizationId!;

        // Who paid
        chargeback.payingUserId = payment.payingUserId;
        chargeback.payingOrganizationId = payment.payingOrganizationId;
        chargeback.customer = payment.customer;

        chargeback.status = PaymentStatus.Created;
        chargeback.price = -payment.price;
        chargeback.roundingAmount = -payment.roundingAmount;
        chargeback.method = payment.method;
        chargeback.type = PaymentType.Chargeback;

        chargeback.provider = payment.provider;
        chargeback.stripeAccountId = payment.stripeAccountId;
        chargeback.reversingPaymentId = payment.id;
        await chargeback.save();

        for (const original of balanceItemPayments) {
            // Create one balance item payment to pay it in one payment
            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = original.balanceItemId;
            balanceItemPayment.paymentId = chargeback.id;
            balanceItemPayment.organizationId = chargeback.organizationId;
            balanceItemPayment.price = -original.price;
            await balanceItemPayment.save();
        }

        // Update cached balance items pending amount (only created balance items, because those are involved in the payment)
        await BalanceItemService.updatePaidAndPending(items);

        const organization = await Organization.getByID(chargeback.organizationId, true);

        try {
            await this.handlePaymentStatusUpdate(chargeback, organization, PaymentStatus.Succeeded, date);
        } catch (e) {
            console.error('Failed to mark chargeback as succeeded', e);
            await chargeback.delete();
            throw e;
        }
        return chargeback;
    }

    static async createPayment({ balanceItems, organization, user, members, checkout, payingOrganization, serviceFeeType, createMandate, useMandate, paymentConfiguration, privatePaymentConfiguration, adminUserId }: {
        balanceItems: Map<BalanceItem, number>;
        organization: Organization;
        user: User | null;
        members?: Member[];
        checkout: Pick<Checkoutable<never>, 'paymentMethod' | 'totalPrice' | 'customer' | 'cancelUrl' | 'redirectUrl'>;
        payingOrganization?: Organization | null;
        serviceFeeType: 'webshop' | 'members' | 'tickets' | 'system';
        createMandate: CreateMandateSettings | null;
        useMandate: PaymentMandate | null;
        paymentConfiguration: PaymentConfiguration;
        privatePaymentConfiguration: PrivatePaymentConfiguration;
        adminUserId?: string | null;
    }) {
        if (balanceItems.size === 0) {
            return null;
        }

        // Calculate total price to pay
        const { price, roundingAmount, hasNegative, names } = this.calculateTotalPrice({ balanceItems, organization, members });
        PaymentService.validateTotalPrice({ price, roundingAmount, checkout });

        const { customer, prefix } = await this.validateCustomer({ user, checkout, payingOrganization, price, hasNegative });
        this.validateVATRates({ customer, sellingOrganization: organization, balanceItems });

        const { method, type, mandate } = await this.validatePaymentMethod({
            method: checkout.paymentMethod ?? PaymentMethod.Unknown,
            mandate: useMandate,
            createMandate: !!createMandate,
            customer,
            price,
            hasNegative,
            balanceItems,
            paymentConfiguration,
            user,
            payingOrganization: payingOrganization ?? null,
            sellingOrganization: organization,
        });

        // Check URL's set fro online payments
        if ((method !== PaymentMethod.Transfer && method !== PaymentMethod.PointOfSale && method !== PaymentMethod.Unknown) && (!checkout.redirectUrl || !checkout.cancelUrl) && !mandate) {
            throw new SimpleError({
                code: 'missing_fields',
                message: 'redirectUrl or cancelUrl is missing and is required for non-zero online payments',
                human: $t(`%vq`),
            });
        }

        // Determine the payment provider (throws if invalid)
        const { provider, stripeAccount } = await organization.getPaymentProviderFor(method, mandate, privatePaymentConfiguration);

        if (createMandate && !mandate) {
            if (provider !== PaymentProvider.Mollie) {
                throw new SimpleError({
                    code: 'cannot_create_mandate_for_provider',
                    message: 'Saving a payment method is not yet supported for this payment method',
                    human: $t('%1U0'),
                });
            }
        }

        // Done validation
        const payment = new Payment();

        // Who will receive this money?
        payment.organizationId = organization.id;

        // Who paid
        payment.payingUserId = !payingOrganization ? (user?.id ?? null) : null;
        payment.payingOrganizationId = payingOrganization?.id ?? null;
        payment.customer = customer;

        payment.status = PaymentStatus.Created;
        payment.paidAt = null;
        payment.price = price;
        payment.roundingAmount = roundingAmount;
        payment.method = method;
        payment.type = type;
        payment.createMandate = createMandate;
        payment.mandateId = mandate?.id ?? null;
        payment.adminUserId = adminUserId ?? null;

        if (price === 0) {
            payment.status = PaymentStatus.Succeeded;
            payment.paidAt = new Date();
        }

        payment.provider = provider;
        payment.stripeAccountId = stripeAccount?.id ?? null;
        await ServiceFeeHelper.setServiceFee(payment, organization, serviceFeeType, [...balanceItems.entries()].map(([_, p]) => p));
        await ServiceFeeHelper.setTransferFee({ payment, organization, stripeAccount });

        // Add transfer description
        if (payment.method === PaymentMethod.Transfer) {
            // remark: we cannot add the lastnames, these will get added in the frontend when it is decrypted
            payment.transferSettings = organization.mappedTransferSettings;

            if (!payment.transferSettings.iban) {
                throw new SimpleError({
                    code: 'no_iban',
                    message: 'No IBAN',
                    human: $t(`%w2`),
                });
            }

            const groupedNames = Formatter.groupNamesByFamily(names);
            payment.generateDescription(
                organization,
                groupedNames,
                {
                    name: groupedNames,
                    naam: groupedNames,
                    email: customer.email ?? user?.email ?? '',
                    prefix,
                },
            );
        }

        await payment.save();

        // Create online payment and balance item payments
        let paymentUrl: string | null = null;
        let paymentQRCode: string | null = null;
        const description = organization.name + ' ' + payment.id;

        try {
            for (const [balanceItem, price] of balanceItems) {
                // Create one balance item payment to pay it in one payment
                const balanceItemPayment = new BalanceItemPayment();
                balanceItemPayment.balanceItemId = balanceItem.id;
                balanceItemPayment.paymentId = payment.id;
                balanceItemPayment.organizationId = organization.id;
                balanceItemPayment.price = price;

                await balanceItemPayment.save();
            }

            // Update cached balance items pending amount (only created balance items, because those are involved in the payment)
            await BalanceItemService.updatePaidAndPending([...balanceItems.keys()]);

            // Update balance items
            if (payment.method === PaymentMethod.Transfer) {
                // Send a small reminder email
                try {
                    await this.sendTransferEmail(customer, user?.id ?? null, organization, payment);
                } catch (e) {
                    console.error('Failed to send transfer email');
                    console.error(e);
                }
            } else if (payment.method !== PaymentMethod.PointOfSale && payment.method !== PaymentMethod.Unknown) {
                if ((!checkout.redirectUrl || !checkout.cancelUrl) && !mandate) {
                    throw new Error('Should have been caught earlier');
                }

                const _redirectUrl = new URL(checkout.redirectUrl ?? ('https://' + STAMHOOFD.domains.dashboard));
                _redirectUrl.searchParams.set('paymentId', payment.id);
                _redirectUrl.searchParams.set('organizationId', payment.payingOrganizationId ?? organization.id); // makes sure the client uses the token associated with this organization when fetching payment polling status

                const _cancelUrl = new URL(checkout.cancelUrl ?? ('https://' + STAMHOOFD.domains.dashboard));
                _cancelUrl.searchParams.set('paymentId', payment.id);
                _cancelUrl.searchParams.set('cancel', 'true');
                _cancelUrl.searchParams.set('organizationId', payment.payingOrganizationId ?? organization.id); // makes sure the client uses the token associated with this organization when fetching payment polling status

                const redirectUrl = _redirectUrl.href;
                const cancelUrl = _cancelUrl.href;

                const webhookUrl = 'https://' + organization.getApiHost() + '/v' + Version + '/payments/' + encodeURIComponent(payment.id) + '?exchange=true';

                if (payment.provider === PaymentProvider.Stripe) {
                    if (createMandate || mandate) {
                        // Already checked, but for security
                        throw new Error('Unsupported');
                    }
                    if (!customer.email) {
                        throw new SimpleError({
                            code: 'missing_email',
                            message: 'Email address is required for online payments via Stripe',
                            human: $t('%1SJ'),
                        });
                    }
                    const stripeResult = await StripeHelper.createPayment({
                        payment,
                        stripeAccount,
                        redirectUrl,
                        cancelUrl,
                        statementDescriptor: organization.name,
                        metadata: {
                            organization: organization.id,
                            user: user?.id,
                            payment: payment.id,
                        },
                        i18n: Context.i18n,
                        organization,
                        customer: {
                            name: customer.name ?? names[0]?.name ?? $t(`%Gr`),
                            email: customer.email,
                        },
                    });
                    paymentUrl = stripeResult.paymentUrl;
                } else if (payment.provider === PaymentProvider.Mollie) {
                    const mollieResult = await MollieService.createPayment({
                        payment,
                        redirectUrl,
                        cancelUrl,
                        webhookUrl,
                        description,
                        metadata: {
                            organization: organization.id,
                            user: user?.id,
                            payment: payment.id,
                        },
                        sellingOrganization: organization,
                        payingOrganization: payingOrganization ?? null,
                        user,
                        customer,
                        mandate,
                    });
                    paymentUrl = mollieResult.paymentUrl;
                } else if (payment.provider === PaymentProvider.Payconiq) {
                    if (createMandate || mandate) {
                        // Already checked, but for security
                        throw new Error('Unsupported');
                    }
                    ({ paymentUrl, paymentQRCode } = await PayconiqPayment.createPayment(payment, organization, description, redirectUrl, webhookUrl));
                } else if (payment.provider === PaymentProvider.Buckaroo) {
                    if (createMandate || mandate) {
                        // Already checked, but for security
                        throw new Error('Unsupported');
                    }

                    // Increase request timeout because buckaroo is super slow (in development)
                    Context.request.request?.setTimeout(60 * 1000);
                    const buckaroo = new BuckarooHelper(organization.privateMeta?.buckarooSettings?.key ?? '', organization.privateMeta?.buckarooSettings?.secret ?? '', organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production');
                    const ip = Context.request.getIP();
                    paymentUrl = await buckaroo.createPayment(payment, ip, description, redirectUrl, webhookUrl);
                    await payment.save();

                    // TypeScript doesn't understand that the status can change and isn't a const....
                    if ((payment.status as any) === PaymentStatus.Failed) {
                        throw new SimpleError({
                            code: 'payment_failed',
                            message: $t(`%w3`, { method: PaymentMethodHelper.getName(payment.method) }),
                        });
                    }
                }
            }
        } catch (e) {
            await PaymentService.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
            throw e;
        }

        // TypeScript thinks status cannot change to Failed, but it can.
        if (payment.status === PaymentStatus.Succeeded || (payment.status as PaymentStatus) === PaymentStatus.Failed) {
            // force update
            const updateTo = payment.status;
            payment.status = PaymentStatus.Created;
            await PaymentService.handlePaymentStatusUpdate(payment, organization, updateTo);
        } else if (payment.method === PaymentMethod.Transfer || payment.method === PaymentMethod.PointOfSale || payment.method === PaymentMethod.Unknown || (payment.method === PaymentMethod.DirectDebit && mandate)) {
            // Mark valid (not same as paid) if needed
            let hasBundleDiscount = false;
            for (const [balanceItem] of balanceItems) {
                // Mark valid
                await BalanceItemService.markPaid(balanceItem, payment, organization);

                if (balanceItem.type === BalanceItemType.RegistrationBundleDiscount) {
                    hasBundleDiscount = true;
                }
            }

            // Flush balance caches so we return an up-to-date balance
            if (hasBundleDiscount) {
                await BalanceItemService.flushRegistrationDiscountsCache();
            }
        }

        return {
            payment,
            provider,
            stripeAccount,
            paymentUrl,
            paymentQRCode,
        };
    }

    static async sendTransferEmail(customer: PaymentCustomer, userId: string | null, organization: Organization, payment: Payment) {
        const email = customer.dynamicEmail;
        if (!email) {
            console.warn('Skipped sending transfer email because of missing email address', payment.id);
            return;
        }
        const paymentGeneral = await payment.getGeneralStructure();
        const groupIds = paymentGeneral.groupIds;

        const replacements = getEmailReplacementsForPayment(paymentGeneral, await buildReplacementOptions([paymentGeneral]));

        const recipients = [
            Recipient.create({
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: email,
                userId,
                replacements,
            }),
        ];

        let group: Group | undefined | null = null;

        if (groupIds.length === 1) {
            group = await Group.getByID(groupIds[0]);
        }

        // Create e-mail builder
        await sendEmailTemplate(organization, {
            template: {
                type: groupIds.length ? EmailTemplateType.RegistrationTransferDetails : EmailTemplateType.RegistrationTransferDetails,
                group,
            },
            type: 'transactional',
            recipients,
        });
    }

    static async validateMandate({
        method,
        paymentConfiguration,
        mandate,
        payingOrganization,
        sellingOrganization,
        user,
    }: {
        method: PaymentMethod;
        paymentConfiguration: PaymentConfiguration;
        mandate: PaymentMandate;
        payingOrganization: Organization | null;
        sellingOrganization: Organization;
        user: User | null;
    }) {
        if (!paymentConfiguration.enableMandates) {
            throw new SimpleError({
                code: 'mandates_disabled',
                message: 'Cannot pay with mandate',
                human: $t('%1SK'),
            });
        }

        // Validate mandate + update payment method based on the mandate
        if (method !== PaymentMethod.Unknown) {
            throw new SimpleError({
                code: 'invalid_data',
                message: 'Cannot combine setting mandate with method',
            });
        }

        const allMandates = await PaymentMandateService.getMandates({
            payingOrganization,
            sellingOrganization,
            user,
        });

        const existingMandate = allMandates.find(m => m.id === mandate.id && m.provider === mandate.provider);
        if (!existingMandate) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Mandate not found',
                human: $t('%1TQ'),
                field: 'mandateId',
            });
        }

        if (existingMandate.status !== PaymentMandateStatus.Valid) {
            throw new SimpleError({
                code: 'mandate_not_valid',
                message: 'Mandate not valid',
                human: $t('%1QA'),
                field: 'mandateId',
            });
        }
        return existingMandate;
    }

    static async validatePaymentMethod({
        method,
        customer,
        price,
        hasNegative,
        balanceItems,
        paymentConfiguration,
        mandate,
        payingOrganization,
        sellingOrganization,
        user,
        createMandate,
    }: {
        method: PaymentMethod;
        customer: PaymentCustomer;
        price: number;
        hasNegative: boolean;
        balanceItems: Map<BalanceItem, number>;
        paymentConfiguration: PaymentConfiguration;
        mandate: PaymentMandate | null;
        payingOrganization: Organization | null;
        sellingOrganization: Organization;
        user: User | null;
        createMandate: boolean;
    }) {
        if (price === 0) {
            if (balanceItems.size === 0) {
                throw new Error('Empty payment');
            }

            // We still need to validate the mandate, because
            // we still allow setting a new default payment method
            // for zero payments
            // - e.g. activating a new package with an existing mandate
            const existingMandate = mandate
                ? await this.validateMandate({
                        method,
                        mandate,
                        paymentConfiguration,
                        payingOrganization,
                        sellingOrganization,
                        user,
                    })
                : null;

            if (createMandate && !existingMandate) {
                throw new SimpleError({
                    code: 'cannot_create_mandate_without_payment',
                    message: 'Cannot create saved payment method without payment of a small amount',
                    human: $t(`%1Ss`),
                });
            }

            // Create an egalizing payment
            if (hasNegative) {
                return {
                    method: PaymentMethod.Unknown,
                    type: PaymentType.Reallocation,
                    mandate: existingMandate,
                };
            }

            return {
                // Free purchase
                method: PaymentMethod.Unknown,
                type: PaymentType.Payment,
                mandate: existingMandate,
            };
        }

        if (mandate) {
            const existingMandate = await this.validateMandate({
                method,
                mandate,
                paymentConfiguration,
                payingOrganization,
                sellingOrganization,
                user,
            });

            switch (existingMandate.type) {
                case PaymentMandateType.CreditCard:
                    return {
                        mandate: existingMandate,
                        method: PaymentMethod.CreditCard,
                        type: PaymentType.Payment,
                    };
                case PaymentMandateType.DirectDebit:
                    return {
                        mandate: existingMandate,
                        method: PaymentMethod.DirectDebit,
                        type: PaymentType.Payment,
                    };
            }

            throw new Error('Unsupported mandate type');
        }

        if (createMandate) {
            if (!paymentConfiguration.enableMandates) {
                throw new SimpleError({
                    code: 'mandates_disabled',
                    message: 'Cannot pay with mandate',
                    human: $t('%1R1'),
                });
            }
        }

        if (method === PaymentMethod.Unknown) {
            throw new SimpleError({
                code: 'invalid_data',
                message: $t(`%vy`),
            });
        }

        // Validate payment method
        const allowedPaymentMethods = paymentConfiguration.getAvailablePaymentMethods({
            amount: price,
            customer: customer,
            forMandate: createMandate,
        });

        if (!allowedPaymentMethods.includes(method)) {
            throw new SimpleError({
                code: 'invalid_payment_method',
                message: $t(`%vp`),
            });
        }

        return {
            method,
            type: PaymentType.Payment,
            mandate: null,
        };
    }

    static validateVATRates({ customer, sellingOrganization, balanceItems }: { customer: PaymentCustomer; sellingOrganization: Organization; balanceItems: Map<BalanceItem, number> }) {
        // Validate VAT rates for this customer
        const seller = VATService.getDefaultCompanyForOrganization(sellingOrganization);
        const excempt = VATService.isVATExcempt({
            company: customer.company,
            sellingOrganization,
        });

        // Reverse charged vat applicable?
        if (excempt) {
            // Check VAT Exempt is set on each an every balance item with a non-zero price
            for (const [item] of balanceItems) {
                if (item.VATExcempt !== VATExcemptReason.IntraCommunityServices && item.VATExcempt !== VATExcemptReason.IntraCommunityGoods) {
                    throw new SimpleError({
                        code: 'VAT_error',
                        message: 'Intra community VAT reverse charge not supported for this purchase',
                        human: $t('%1LI'),
                    });
                }

                // We also need to know the VAT rate exactly to be sure the VAT is removed from the purchase
                // If VAT is not included, we don't need to know the VAT percentage until the payment is invoiced
                if (item.VATPercentage === null && item.VATIncluded) {
                    throw new SimpleError({
                        code: 'VAT_error',
                        message: 'Intra community VAT reverse charge is not supported for this purchase because of missing VAT rates',
                        human: $t('%1LJ'),
                    });
                }
            }
        } else {
            // Fine to just not have setup VAT rates yet if the price is guaranteed to include VAT
            for (const [item] of balanceItems) {
                if (item.VATExcempt === VATExcemptReason.IntraCommunityGoods || item.VATExcempt === VATExcemptReason.IntraCommunityServices) {
                    throw new SimpleError({
                        code: 'VAT_error',
                        message: 'Unexpected reverse charge applied',
                        human: $t('%1LK'),
                    });
                }

                if (seller && seller.VATNumber) {
                    if (!item.VATIncluded && item.VATPercentage === null) {
                        throw new SimpleError({
                            code: 'VAT_error',
                            message: 'Missing VAT percentage',
                            human: $t('%1LL'),
                        });
                    }
                }
            }
        }

        /* if (seller && seller.VATNumber && seller.address && customer.company) {
            // B2B validation
            if (!customer.company.address) {
                throw new SimpleError({
                    code: 'missing_field',
                    message: 'Company address missing',
                    human: $t('%1LH'),
                    field: 'customer.company.address',
                });
            }

        }
        else {
            // B2C / C2B / C2C

            // You cannot buy balance items with VAT if you didn't set up a VAT number.
            for (const [item] of balanceItems) {
                if (item.VATExcempt === VATExcemptReason.IntraCommunityGoods || item.VATExcempt === VATExcemptReason.IntraCommunityServices) {
                    throw new SimpleError({
                        code: 'VAT_error',
                        message: 'Unexpected reverse charge applied',
                        human: $t('%1LK'),
                    });
                }

                if (seller && seller.VATNumber) {
                    if (!item.VATIncluded && item.VATPercentage === null) {
                        throw new SimpleError({
                            code: 'VAT_error',
                            message: 'Missing VAT percentage',
                            human: $t('%1LL'),
                        });
                    }
                }
            }
        } */

        return { seller };
    }
};
