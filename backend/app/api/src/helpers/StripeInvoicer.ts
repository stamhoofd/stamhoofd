import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/email';
import { BalanceItem, BalanceItemPayment, Organization, Payment, StripeAccount, User } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, getPaymentProviderName, PaymentCustomer, PaymentMethod, PaymentProvider, PaymentStatus, PaymentType, TranslatedString } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import Stripe from 'stripe';
import { PaymentService } from '../services/PaymentService.js';
import { VATService } from '../services/VATService.js';

export class ApplicationFeeDetails {
    transferFee = 0;
    serviceFee = 0;
    count = 0;
    minimumDate: Date | null = null;
    maximumDate: Date | null = null;

    constructor(details: { count?: number; transferFee: number; serviceFee: number; minimumDate: Date | null; maximumDate: Date | null }) {
        this.count = details.count ?? 0;
        this.transferFee = details.transferFee;
        this.serviceFee = details.serviceFee;
        this.minimumDate = details.minimumDate;
        this.maximumDate = details.maximumDate;
    }

    get amount() {
        return this.transferFee + this.serviceFee;
    }

    static fromStripe(transaction: Stripe.BalanceTransaction) {
        const source = transaction.source as Stripe.ApplicationFee;
        const metadata = (source.originating_transaction as Stripe.Charge).metadata;

        const serviceFeeStr = metadata.serviceFee as unknown;
        if (serviceFeeStr === undefined || typeof serviceFeeStr !== 'string') {
            throw new Error('Missing serviceFee metadata');
        }

        const parsed = parseInt(serviceFeeStr);
        if (isNaN(parsed) || !isFinite(parsed)) {
            throw new Error('Invalid serviceFee metadata');
        }
        const serviceFee = parsed * 100; // in cents
        const transferFee = transaction.amount * 100 - serviceFee;

        return new ApplicationFeeDetails({
            count: 1,
            serviceFee,
            transferFee,
            minimumDate: new Date(transaction.created * 1000),
            maximumDate: new Date(transaction.created * 1000),
        });
    }

    add(fee: Stripe.BalanceTransaction) {
        this.combine(ApplicationFeeDetails.fromStripe(fee));
    }

    remove(fee: Stripe.BalanceTransaction) {
        this.combine(ApplicationFeeDetails.fromStripe(fee));
    }

    combine(other: ApplicationFeeDetails) {
        this.serviceFee += other.serviceFee;
        this.transferFee += other.transferFee;
        this.count += other.count;
        if (other.minimumDate && (this.minimumDate === null || other.minimumDate < this.minimumDate)) {
            this.minimumDate = other.minimumDate;
        }
        if (other.maximumDate && (this.maximumDate === null || other.maximumDate > this.maximumDate)) {
            this.maximumDate = other.maximumDate;
        }
    }
}

class StripeReport {
    readonly applicationFeesPerAccount = new Map<string, ApplicationFeeDetails>();

    add(balanceTransaction: Stripe.BalanceTransaction) {
        if (balanceTransaction.type === 'application_fee' || balanceTransaction.type === 'application_fee_refund') {
            const source = balanceTransaction.source as Stripe.ApplicationFee;
            const account = typeof source.account === 'string' ? source.account : source.account.id;

            if (account) {
                // We don't included refunded fees because these are test payments from test account
                const currentAmount = this.applicationFeesPerAccount.get(account);
                if (currentAmount === undefined) {
                    this.applicationFeesPerAccount.set(account, ApplicationFeeDetails.fromStripe(balanceTransaction));
                } else {
                    currentAmount.add(balanceTransaction);
                }
            }
        }
    }

    combine(report: StripeReport) {
        for (const [account, amount] of report.applicationFeesPerAccount.entries()) {
            const currentAmount = this.applicationFeesPerAccount.get(account);
            if (currentAmount === undefined) {
                this.applicationFeesPerAccount.set(account, amount);
            } else {
                currentAmount.combine(amount);
            }
        }
        return this;
    }
}

export class StripeReportInvoicer {
    private readonly report: StripeReport;
    start: Date;
    end: Date;

    constructor(report: StripeReport, start: Date, end: Date) {
        this.report = report;
        this.start = start;
        this.end = end;
    }

    async generateInvoices(sellingOrganization: Organization, reference: string) {
        const payments: Payment[] = [];
        for (const [account, details] of this.report.applicationFeesPerAccount) {
            try {
                const payment = await this.generateInvoice(sellingOrganization, reference, account, details);
                if (payment) {
                    payments.push(payment);
                }
            } catch (e) {
                console.error(e);
                // Send email notification of this error
                Email.sendWebmaster({
                    subject: 'Aanmaken Stripe facturen voor ' + account + ' - ' + reference + ' mislukt',
                    html: 'Aanmaken Stripe facturen voor ' + account + ' - ' + reference + ' mislukt. <br><br> ' + e.toString(),
                });
            }
        }
        return payments;
    }

    static async hasPayment(sellingOrganization: Organization, reference: string) {
        return !!await Payment.select().where('organizationId', sellingOrganization.id).where('reference', reference).where('status', PaymentStatus.Succeeded).first(false);
    }

    async generateInvoice(sellingOrganization: Organization, reference: string, accountId: string, applicationFee: ApplicationFeeDetails) {
        if (applicationFee.amount === 0) {
            return;
        }

        const seller = sellingOrganization.meta.companies[0];
        if (!seller) {
            return;
        }

        // Search for the organization in Stamhoofd
        const stripeAccount = await StripeAccount.select().where('accountId', accountId).first(false);
        if (!stripeAccount) {
            if (STAMHOOFD.environment === 'test') {
                console.error('No organization found for Stripe account ' + accountId);
                return;
            }
            throw new SimpleError({
                code: 'stripe_account_not_found',
                message: 'No organization found for Stripe account ' + accountId,
            });
        }
        const organization = await Organization.getByID(stripeAccount.organizationId);

        if (!organization) {
            throw new SimpleError({
                code: 'organization_not_found',
                message: 'No organization found for Stripe account ' + accountId,
            });
        }

        const existingPayments = await Payment.select()
            .where('organizationId', sellingOrganization.id)
            .where('payingOrganizationId', organization.id)
            .where('reference', reference)
            .where('status', PaymentStatus.Succeeded)
            .fetch();

        for (const i of existingPayments) {
            if (i.price !== applicationFee.amount) {
                throw new SimpleError({
                    code: 'payment_already_exists_with_different_amount',
                    message: 'Payment already exists with different amount ' + organization.id + ' expected ' + applicationFee.amount + ' got ' + i.price + ' in payment ' + i.id,
                });
            }
        }

        if (existingPayments.length) {
            console.warn('Tried to create an already created stripe invoice payment ' + existingPayments.map(p => p.id).join(', '));
            return;
        }

        const customer = PaymentCustomer.create({
            company: organization.defaultCompanies[0],
        });

        if (customer.company!.isSameEntity(seller)) {
            throw new SimpleError({
                code: 'same_customer',
                message: 'Cannot invoice self',
            });
        }

        const balanceItems: BalanceItem[] = [];

        if (applicationFee.serviceFee !== 0) {
            const item = new BalanceItem();
            item.type = BalanceItemType.ServiceFee;
            item.description = $t('%1Wd', {
                startDate: Formatter.startDate(this.start, false, true),
                endDate: Formatter.endDate(this.end, false, true),
            });
            item.relations.set(BalanceItemRelationType.PaymentProvider, BalanceItemRelation.create({
                id: PaymentProvider.Stripe,
                name: TranslatedString.create(getPaymentProviderName(PaymentProvider.Stripe)),
            }));
            item.payingOrganizationId = organization.id;
            item.organizationId = sellingOrganization.id;
            item.VATPercentage = 21;
            item.VATExcempt = VATService.getVATExcempt({
                company: organization.defaultCompanies[0] ?? null,
                sellingOrganization,
                type: 'services',
            });
            item.VATIncluded = true;
            item.quantity = 1;
            item.unitPrice = applicationFee.serviceFee;
            item.createdAt = new Date();
            item.status = BalanceItemStatus.Hidden;
            item.startDate = this.start;
            item.endDate = this.end;
            await item.save();
            balanceItems.push(item);
        }

        if (applicationFee.transferFee !== 0) {
            const item = new BalanceItem();
            item.type = BalanceItemType.TransferFee;
            item.description = $t('%1Xx', {
                startDate: Formatter.startDate(this.start, false, true),
                endDate: Formatter.endDate(this.end, false, true),
            });
            item.relations.set(BalanceItemRelationType.PaymentProvider, BalanceItemRelation.create({
                id: PaymentProvider.Stripe,
                name: TranslatedString.create(getPaymentProviderName(PaymentProvider.Stripe)),
            }));
            item.payingOrganizationId = organization.id;
            item.organizationId = sellingOrganization.id;
            item.VATPercentage = 21;
            item.VATExcempt = VATService.getVATExcempt({
                company: organization.defaultCompanies[0] ?? null,
                sellingOrganization,
                type: 'services',
            });
            item.VATIncluded = true;
            item.quantity = 1;
            item.unitPrice = applicationFee.transferFee;
            item.createdAt = new Date();
            item.status = BalanceItemStatus.Hidden;
            item.startDate = this.start;
            item.endDate = this.end;
            await item.save();
            balanceItems.push(item);
        }

        const systemUser = await User.getSystem();

        // Done validation
        const payment = new Payment();
        payment.adminUserId = systemUser.id;

        // Who will receive this money?
        payment.organizationId = sellingOrganization.id;

        // Who paid
        payment.payingOrganizationId = organization.id;
        payment.customer = customer;

        payment.status = PaymentStatus.Pending;
        payment.price = applicationFee.amount;
        payment.roundingAmount = 0;
        payment.method = PaymentMethod.AccountDeductions;
        payment.type = PaymentType.Payment;
        payment.createMandate = null;
        payment.reference = reference;

        payment.provider = PaymentProvider.Stripe;
        payment.stripeAccountId = stripeAccount.id;
        await payment.save();

        for (const balanceItem of balanceItems) {
            // Create one balance item payment to pay it in one payment
            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = organization.id;
            balanceItemPayment.price = balanceItem.priceWithVAT;
            await balanceItemPayment.save();
        }

        await PaymentService.handlePaymentStatusUpdate(payment, sellingOrganization, PaymentStatus.Succeeded, this.start);
        return payment;
    }
}

export class StripeInvoicer {
    private stripe: Stripe;

    constructor({ secretKey }: { secretKey: string }) {
        this.stripe = new Stripe(secretKey, { apiVersion: '2024-06-20', typescript: true, maxNetworkRetries: 1, timeout: 10000 });
    }

    static getMonthUnixStartEnd(date: Date) {
        const start = Math.floor((new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime()) / 1000);
        const end = Math.ceil((new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0).getTime() - 1000) / 1000);
        return { start, end };
    }

    // Loops all months until all invoices are generated
    async generateAllInvoices(sellingOrganization: Organization, options?: { force?: boolean; start?: Date }) {
        const startMonth = options?.start ?? new Date(2026, 0, 1);
        const stopAt = new Date(Date.now() + (STAMHOOFD.environment === 'production' ? (-60 * 60 * 24 * 1000) : (60 * 60 * 24 * 1000 * 31))); // One day margin before creating invoices
        let currentMonth = new Date(startMonth);

        while (true) {
            const { start, end } = StripeInvoicer.getMonthUnixStartEnd(currentMonth);

            if (end >= stopAt.getTime() / 1000) {
                // Stop
                break;
            }
            await this.generateInvoices(sellingOrganization, currentMonth, options);
            currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        }
    }

    async generateInvoices(sellingOrganization: Organization, month: Date, options?: { force?: boolean }) {
        const { start, end } = StripeInvoicer.getMonthUnixStartEnd(month);
        const reference = 'stripe-fees-' + Formatter.dateIso(new Date(start * 1000));

        try {
            await QueueHandler.schedule(reference, async () => {
                if (!options?.force && await StripeReportInvoicer.hasPayment(sellingOrganization, reference)) {
                    console.log('Already invoiced month', reference);
                    return;
                }

                console.log('Generating invoices for ', reference, start, end);
                const reportFees = await this.fetchBalanceItems({
                    created: {
                        gte: start,
                        lte: end,
                    },
                    type: 'application_fee',
                    expand: ['data.source', 'data.source.originating_transaction'],
                });
                const reportRefund = await this.fetchBalanceItems({
                    created: {
                        gte: start,
                        lte: end,
                    },
                    type: 'application_fee_refund',
                    expand: ['data.source', 'data.source.originating_transaction'],
                });

                const report = reportFees.combine(reportRefund);
                const invoicer = new StripeReportInvoicer(report, new Date(start * 1000), new Date(end * 1000));
                await invoicer.generateInvoices(sellingOrganization, reference);
            });
        } catch (e) {
            console.error(e);

            // Send email notification of this error
            Email.sendWebmaster({
                subject: 'Aanmaken Stripe facturen voor ' + Formatter.dateNumber(month) + ' mislukt',
                html: 'Aanmaken Stripe facturen voor ' + Formatter.dateNumber(month) + ' mislukt. <br><br> ' + e.toString(),
            });
        }
    }

    private async fetchBalanceItems(options: Stripe.BalanceTransactionListParams) {
        // For the given payout, fetch all balance items
        const params = { ...options };
        const report = new StripeReport();

        for await (const balanceItem of this.stripe.balanceTransactions.list(params)) {
            report.add(balanceItem);
        }

        return report;
    }
}
