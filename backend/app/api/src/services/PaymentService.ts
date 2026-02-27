import createMollieClient, { PaymentMethod as molliePaymentMethod, PaymentStatus as MolliePaymentStatus } from '@mollie/api-client';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, BalanceItemPayment, Group, Member, MolliePayment, MollieToken, Organization, PayconiqPayment, Payment, sendEmailTemplate, User } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { AuditLogSource, BalanceItemType, Checkoutable, Country, EmailTemplateType, PaymentConfiguration, PaymentCustomer, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus, PaymentType, Recipient, VATExcemptReason, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { buildReplacementOptions, getEmailReplacementsForPayment } from '../email-replacements/getEmailReplacementsForPayment.js';
import { BuckarooHelper } from '../helpers/BuckarooHelper.js';
import { Context } from '../helpers/Context.js';
import { ServiceFeeHelper } from '../helpers/ServiceFeeHelper.js';
import { StripeHelper } from '../helpers/StripeHelper.js';
import { AuditLogService } from './AuditLogService.js';
import { BalanceItemPaymentService } from './BalanceItemPaymentService.js';
import { BalanceItemService } from './BalanceItemService.js';

export class PaymentService {
    static async handlePaymentStatusUpdate(payment: Payment, organization: Organization, status: PaymentStatus) {
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

                    // Flush caches so data is up to date in response
                    await BalanceItemService.flushCaches(organization.id);
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

                    // Flush caches so data is up to date in response
                    await BalanceItemService.flushCaches(organization.id);
                });
            }

            // Moved to failed
            if (status === PaymentStatus.Failed) {
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
                        if (molliePayments.length === 1) {
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
    }

    static isManualExpired(status: PaymentStatus, payment: Payment) {
        if ((status === PaymentStatus.Pending || status === PaymentStatus.Created) && payment.method !== PaymentMethod.DirectDebit) {
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
    static shouldTryToCancel(status: PaymentStatus, payment: Payment): boolean {
        if ((status === PaymentStatus.Pending || status === PaymentStatus.Created) && payment.method !== PaymentMethod.DirectDebit) {
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
     * To fix that, we create an extra balance item with the difference. So the rounding always matches.
     *
     * TODO: update this method to generate a virtual invoice and use the price of the invoice instead of the rounded payment price, so we don't get differences in calculation
     */
    static round(payment: Payment) {
        const amount = payment.price;
        const rounded = Payment.roundPrice(payment.price);
        const difference = rounded - amount;

        if (difference === 0) {
            return;
        }

        if (difference > 100 || difference < -100) {
            throw new Error('Unexpected rounding difference of ' + difference + ' for payment ' + payment.id);
        }

        payment.roundingAmount = difference;

        // Change payment total price
        payment.price += difference;
    }

    static async createPayment({ balanceItems, organization, user, members, checkout, payingOrganization, serviceFeeType }: {
        balanceItems: Map<BalanceItem, number>;
        organization: Organization;
        user: User;
        members?: Member[];
        checkout: Pick<Checkoutable<never>, 'paymentMethod' | 'totalPrice' | 'customer' | 'cancelUrl' | 'redirectUrl'>;
        payingOrganization?: Organization | null;
        serviceFeeType: 'webshop' | 'members' | 'tickets' | 'system';
    }) {
        // Calculate total price to pay
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
                    message: $t(`38ddccb2-7cf6-4b47-aa71-d11ad73386d8`),
                });
            }

            if (price < 0 && price < Math.min(balanceItem.priceOpen, balanceItem.priceDue - balanceItem.pricePaid)) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: $t(`dd14a1d9-c569-4d5e-bb26-569ecede4c52`),
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
                        message: $t(`e64b8269-1cda-434d-8d6f-35be23a9d6e9`),
                    });
                }
                names.push({
                    firstName: member.firstName,
                    lastName: member.lastName,
                    name: member.details.name,
                });
            }
        }

        if (totalPrice < 0) {
            // todo: try to make it non-negative by reducing some balance items
            throw new SimpleError({
                code: 'negative_price',
                message: $t(`725715e5-b0ac-43c1-adef-dd42b8907327`),
            });
        }

        if (checkout.totalPrice !== null && totalPrice !== checkout.totalPrice) {
            // Changed!
            throw new SimpleError({
                code: 'changed_price',
                message: $t(`e424d549-2bb8-4103-9a14-ac4063d7d454`, { total: Formatter.price(totalPrice) }),
            });
        }

        const payment = new Payment();

        // Who will receive this money?
        payment.organizationId = organization.id;

        // Who paid
        payment.payingUserId = user.id;
        payment.payingOrganizationId = payingOrganization?.id ?? null;

        // Fill in customer default value
        payment.customer = PaymentCustomer.create({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
        });

        // Use structured transfer description prefix
        let prefix = '';

        if (payingOrganization) {
            if (totalPrice !== 0 || hasNegative || checkout.customer) {
                if (!checkout.customer) {
                    throw new SimpleError({
                        code: 'missing_fields',
                        message: 'customer is required when paying as an organization',
                        human: $t(`d483aa9a-289c-4c59-955f-d2f99ec533ab`),
                    });
                }

                if (!checkout.customer.company) {
                    throw new SimpleError({
                        code: 'missing_fields',
                        message: 'customer.company is required when paying as an organization',
                        human: $t(`bc89861d-a799-4100-b06c-29d6808ba8d2`),
                    });
                }

                // Search company id
                // this avoids needing to check the VAT number every time
                const id = checkout.customer.company.id;
                const foundCompany = payingOrganization.meta.companies.find(c => c.id === id);

                if (!foundCompany) {
                    throw new SimpleError({
                        code: 'invalid_data',
                        message: $t(`0ab71307-8f4f-4701-b120-b552a1b6bdd0`),
                    });
                }

                payment.customer.company = foundCompany;

                const orgNumber = parseInt(payingOrganization.uri);

                if (orgNumber !== 0 && !isNaN(orgNumber)) {
                    prefix = orgNumber + '';
                }
            }
            else {
                // Zero amount payment (without refunds) without specifying a company will just use the default company to link to the payment
                // It doesn't really matter since the price is zero and we won't invoice it.
                const company = payingOrganization.meta.companies[0];
                if (company) {
                    payment.customer.company = company;
                }
            }
        }

        // Validate VAT rates for this customer
        await this.validateVATRates({ customer: payment.customer, organization, balanceItems });

        payment.status = PaymentStatus.Created;
        payment.paidAt = null;
        payment.price = totalPrice;
        PaymentService.round(payment);
        totalPrice = payment.price;

        if (totalPrice === 0) {
            payment.status = PaymentStatus.Succeeded;
            payment.paidAt = new Date();
        }

        // Validate payment method after customer is defined
        const paymentConfiguration = organization.meta.registrationPaymentConfiguration;
        const privatePaymentConfiguration = organization.privateMeta.registrationPaymentConfiguration;

        payment.method = checkout.paymentMethod ?? PaymentMethod.Unknown;
        await this.validatePaymentMethod({ payment, balanceItems, paymentConfiguration });

        // Validate URL's for online payments before saving the payment
        if ((payment.method !== PaymentMethod.Transfer && payment.method !== PaymentMethod.PointOfSale && payment.method !== PaymentMethod.Unknown) && (!checkout.redirectUrl || !checkout.cancelUrl)) {
            throw new SimpleError({
                code: 'missing_fields',
                message: 'redirectUrl or cancelUrl is missing and is required for non-zero online payments',
                human: $t(`ebe54b63-2de6-4f22-a5ed-d3fe65194562`),
            });
        }

        // Add transfer description
        if (payment.method === PaymentMethod.Transfer) {
            // remark: we cannot add the lastnames, these will get added in the frontend when it is decrypted
            payment.transferSettings = organization.mappedTransferSettings;

            if (!payment.transferSettings.iban) {
                throw new SimpleError({
                    code: 'no_iban',
                    message: 'No IBAN',
                    human: $t(`cc8b5066-a7e4-4eae-b556-f56de5d3502c`),
                });
            }

            const groupedNames = Formatter.groupNamesByFamily(names);
            payment.generateDescription(
                organization,
                groupedNames,
                {
                    name: groupedNames,
                    naam: groupedNames,
                    email: user.email,
                    prefix,
                },
            );
        }

        // Determine the payment provider
        // Throws if invalid
        const { provider, stripeAccount } = await organization.getPaymentProviderFor(payment.method, privatePaymentConfiguration);
        payment.provider = provider;
        payment.stripeAccountId = stripeAccount?.id ?? null;
        ServiceFeeHelper.setServiceFee(payment, organization, serviceFeeType, [...balanceItems.entries()].map(([_, p]) => p));

        await payment.save();
        let paymentUrl: string | null = null;
        let paymentQRCode: string | null = null;
        const description = organization.name + ' ' + payment.id;

        // Create balance item payments
        const balanceItemPayments: (BalanceItemPayment & { balanceItem: BalanceItem })[] = [];

        try {
            for (const [balanceItem, price] of balanceItems) {
                // Create one balance item payment to pay it in one payment
                const balanceItemPayment = new BalanceItemPayment();
                balanceItemPayment.balanceItemId = balanceItem.id;
                balanceItemPayment.paymentId = payment.id;
                balanceItemPayment.organizationId = organization.id;
                balanceItemPayment.price = price;
                await balanceItemPayment.save();

                balanceItemPayments.push(balanceItemPayment.setRelation(BalanceItemPayment.balanceItem, balanceItem));
            }

            // Update balance items
            if (payment.method === PaymentMethod.Transfer) {
                // Send a small reminder email
                try {
                    await this.sendTransferEmail(user, organization, payment);
                }
                catch (e) {
                    console.error('Failed to send transfer email');
                    console.error(e);
                }
            }
            else if (payment.method !== PaymentMethod.PointOfSale && payment.method !== PaymentMethod.Unknown) {
                if (!checkout.redirectUrl || !checkout.cancelUrl) {
                    throw new Error('Should have been caught earlier');
                }

                const _redirectUrl = new URL(checkout.redirectUrl);
                _redirectUrl.searchParams.set('paymentId', payment.id);
                _redirectUrl.searchParams.set('organizationId', organization.id); // makes sure the client uses the token associated with this organization when fetching payment polling status

                const _cancelUrl = new URL(checkout.cancelUrl);
                _cancelUrl.searchParams.set('paymentId', payment.id);
                _cancelUrl.searchParams.set('cancel', 'true');
                _cancelUrl.searchParams.set('organizationId', organization.id); // makes sure the client uses the token associated with this organization when fetching payment polling status

                const redirectUrl = _redirectUrl.href;
                const cancelUrl = _cancelUrl.href;

                const webhookUrl = 'https://' + organization.getApiHost() + '/v' + Version + '/payments/' + encodeURIComponent(payment.id) + '?exchange=true';

                if (payment.provider === PaymentProvider.Stripe) {
                    const stripeResult = await StripeHelper.createPayment({
                        payment,
                        stripeAccount,
                        redirectUrl,
                        cancelUrl,
                        statementDescriptor: organization.name,
                        metadata: {
                            organization: organization.id,
                            user: user.id,
                            payment: payment.id,
                        },
                        i18n: Context.i18n,
                        lineItems: balanceItemPayments,
                        organization,
                        customer: {
                            name: user.name ?? names[0]?.name ?? $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`),
                            email: user.email,
                        },
                    });
                    paymentUrl = stripeResult.paymentUrl;
                }
                else if (payment.provider === PaymentProvider.Mollie) {
                    // Mollie payment
                    const token = await MollieToken.getTokenFor(organization.id);
                    if (!token) {
                        throw new SimpleError({
                            code: '',
                            message: $t(`b77e1f68-8928-42a2-802b-059fa73bedc3`, { method: PaymentMethodHelper.getName(payment.method) }),
                        });
                    }
                    const profileId = organization.privateMeta.mollieProfile?.id ?? await token.getProfileId(organization.getHost());
                    if (!profileId) {
                        throw new SimpleError({
                            code: '',
                            message: $t(`5574469f-8eee-47fe-9fb6-1b097142ac75`, { method: PaymentMethodHelper.getName(payment.method) }),
                        });
                    }
                    const mollieClient = createMollieClient({ accessToken: await token.getAccessToken() });
                    const locale = Context.i18n.locale.replace('-', '_');
                    const molliePayment = await mollieClient.payments.create({
                        amount: {
                            currency: 'EUR',
                            value: (totalPrice / 100).toFixed(2),
                        },
                        method: payment.method == PaymentMethod.Bancontact ? molliePaymentMethod.bancontact : (payment.method == PaymentMethod.iDEAL ? molliePaymentMethod.ideal : molliePaymentMethod.creditcard),
                        testmode: organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production',
                        profileId,
                        description,
                        redirectUrl,
                        webhookUrl,
                        metadata: {
                            paymentId: payment.id,
                        },
                        locale: ['en_US', 'en_GB', 'nl_NL', 'nl_BE', 'fr_FR', 'fr_BE', 'de_DE', 'de_AT', 'de_CH', 'es_ES', 'ca_ES', 'pt_PT', 'it_IT', 'nb_NO', 'sv_SE', 'fi_FI', 'da_DK', 'is_IS', 'hu_HU', 'pl_PL', 'lv_LV', 'lt_LT'].includes(locale) ? (locale as any) : null,
                    });
                    paymentUrl = molliePayment.getCheckoutUrl();

                    // Save payment
                    const dbPayment = new MolliePayment();
                    dbPayment.paymentId = payment.id;
                    dbPayment.mollieId = molliePayment.id;
                    await dbPayment.save();
                }
                else if (payment.provider === PaymentProvider.Payconiq) {
                    ({ paymentUrl, paymentQRCode } = await PayconiqPayment.createPayment(payment, organization, description, redirectUrl, webhookUrl));
                }
                else if (payment.provider === PaymentProvider.Buckaroo) {
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
                            message: $t(`b77e1f68-8928-42a2-802b-059fa73bedc3`, { method: PaymentMethodHelper.getName(payment.method) }),
                        });
                    }
                }
            }
        }
        catch (e) {
            await PaymentService.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
            throw e;
        }

        // Mark valid if needed
        if (payment.method === PaymentMethod.Transfer || payment.method === PaymentMethod.PointOfSale || payment.method === PaymentMethod.Unknown) {
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
            balanceItemPayments,
            provider,
            stripeAccount,
            paymentUrl,
            paymentQRCode,
        };
    }

    static async sendTransferEmail(user: User, organization: Organization, payment: Payment) {
        const paymentGeneral = await payment.getGeneralStructure();
        const groupIds = paymentGeneral.groupIds;

        const replacements = getEmailReplacementsForPayment(paymentGeneral, await buildReplacementOptions([paymentGeneral]));

        const recipients = [
            Recipient.create({
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                userId: user.id,
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

    static async validatePaymentMethod({ payment, balanceItems, paymentConfiguration }: { payment: Payment; balanceItems: Map<BalanceItem, number>; paymentConfiguration: PaymentConfiguration }) {
        if (payment.price === 0) {
            if (balanceItems.size === 0) {
                return;
            }
            // Create an egalizing payment
            payment.method = PaymentMethod.Unknown;

            if ([...balanceItems.values()].find(b => b < 0)) {
                payment.type = PaymentType.Reallocation;
            }
        }
        else if (payment.method === PaymentMethod.Unknown) {
            throw new SimpleError({
                code: 'invalid_data',
                message: $t(`86c7b6f7-3ec9-4af3-a5e6-b5de6de80d73`),
            });
        }
        else {
            // Validate payment method
            const allowedPaymentMethods = paymentConfiguration.getAvailablePaymentMethods({
                amount: payment.price,
                customer: payment.customer,
            });

            if (!allowedPaymentMethods.includes(payment.method)) {
                throw new SimpleError({
                    code: 'invalid_payment_method',
                    message: $t(`2b1ca6a0-662e-4326-ada1-10239b6ddc6f`),
                });
            }
        }
    }

    static async validateVATRates({ customer, organization, balanceItems }: { customer: PaymentCustomer; organization: Organization; balanceItems: Map<BalanceItem, number> }) {
        // Validate VAT rates for this customer
        const seller = organization.meta.companies[0];
        if (seller && seller.VATNumber && seller.address && customer.company) {
            // B2B validation
            if (!customer.company.address) {
                throw new SimpleError({
                    code: 'missing_field',
                    message: 'Company address missing',
                    human: $t('Facturatieadres ontbreekt'),
                    field: 'customer.company.address',
                });
            }

            // Reverse charged vat applicable?
            if (customer.company.address.country !== seller.address.country) {
                // Check VAT Exempt is set on each an every balance item with a non-zero price
                for (const [item] of balanceItems) {
                    if (item.VATExcempt !== VATExcemptReason.IntraCommunity) {
                        throw new SimpleError({
                            code: 'VAT_error',
                            message: 'Intra community VAT reverse charge not supported for this purchase',
                            human: $t('Er is geen ondersteuning voor intracommunautaire BTW-verlegging bij deze aankoop. Gelieve contact op te nemen.'),
                        });
                    }

                    // We also need to know the VAT rate exactly to be sure the VAT is removed from the purchase
                    // If VAT is not included, we don't need to know the VAT percentage until the payment is invoiced
                    if (item.VATPercentage === null && item.VATIncluded) {
                        throw new SimpleError({
                            code: 'VAT_error',
                            message: 'Intra community VAT reverse charge is not supported for this purchase because of missing VAT rates',
                            human: $t('Er is geen ondersteuning voor intracommunautaire BTW-verlegging bij deze aankoop doordat de BTW-tarieven nog niet geconfigureerd werden. Gelieve contact op te nemen.'),
                        });
                    }
                }
            }
            else {
                // Fine to just not have setup VAT rates yet if the price is guaranteed to include VAT
                for (const [item] of balanceItems) {
                    if (item.VATExcempt === VATExcemptReason.IntraCommunity) {
                        throw new SimpleError({
                            code: 'VAT_error',
                            message: 'Unexpected reverse charge applied',
                            human: $t('Er werd foutief BTW-verlegd bij deze aankoop. Herlaad de pagina en probeer het opnieuw of neem contact op.'),
                        });
                    }

                    if (!item.VATIncluded && item.VATPercentage === null) {
                        throw new SimpleError({
                            code: 'VAT_error',
                            message: 'Missing VAT percentage',
                            human: $t('Er ontbreekt een BTW-percentage'),
                        });
                    }
                }
            }
        }
        else {
            // B2C / C2B / C2C

            // You cannot buy balance items with VAT if you didn't set up a VAT number.
            for (const [item] of balanceItems) {
                if (item.VATExcempt === VATExcemptReason.IntraCommunity) {
                    throw new SimpleError({
                        code: 'VAT_error',
                        message: 'Unexpected reverse charge applied',
                        human: $t('Er werd foutief BTW-verlegd bij deze aankoop. Herlaad de pagina en probeer het opnieuw of neem contact op.'),
                    });
                }

                if (seller && seller.VATNumber) {
                    if (!item.VATIncluded && item.VATPercentage === null) {
                        throw new SimpleError({
                            code: 'VAT_error',
                            message: 'Missing VAT percentage',
                            human: $t('Er ontbreekt een BTW-percentage'),
                        });
                    }
                }
            }
        }
    }
};
