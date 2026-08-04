import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/email';
import { BalanceItem, BalanceItemPayment, Organization, Payment, StripeAccount, User } from '@stamhoofd/models';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { QueueHandler } from '@stamhoofd/queues';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, getPaymentProviderName, PaymentCustomer, PaymentMethod, PaymentProvider, PaymentStatus, PaymentType, TranslatedString } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { Formatter } from '@stamhoofd/utility';
import type Stripe from 'stripe';
import { PaymentService } from '../services/PaymentService.js';
import { SettlementService } from '../services/SettlementService.js';
import { VATService } from '../services/VATService.js';
import { SQL } from '@stamhoofd/sql';
import { StripeFeeSync } from './StripeFeeSync.js';

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

    static fromStripe(transaction: Pick<Stripe.BalanceTransaction, 'source' | 'amount' | 'created'>) {
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
}

/**
 * The balance items of one fee invoice, per fee kind. A kind is null when nothing of that kind was
 * charged that month.
 */
export type FeeBalanceItems = {
    serviceFee: BalanceItem | null;
    transferFee: BalanceItem | null;
};

export class StripeReportInvoicer {
    private readonly report: StripeReport;
    start: Date;
    end: Date;

    constructor(report: StripeReport, start: Date, end: Date) {
        this.report = report;
        this.start = start;
        this.end = end;
    }

    /**
     * Creates one invoice payment per account. `onInvoiced` runs directly after each created
     * invoice: an error for one account (creating or the onInvoiced step) can never affect the
     * invoices already created for other accounts.
     */
    async generateInvoices(sellingOrganization: Organization, reference: string, onInvoiced?: (accountId: string, balanceItems: FeeBalanceItems) => Promise<void>): Promise<void> {
        for (const [account, details] of this.report.applicationFeesPerAccount) {
            let result: { payment: Payment; balanceItems: FeeBalanceItems } | undefined;
            try {
                result = await this.generateInvoice(sellingOrganization, reference, account, details);
            } catch (e) {
                console.error(e);
                // Send email notification of this error
                Email.sendWebmaster({
                    subject: 'Aanmaken Stripe facturen voor ' + account + ' - ' + reference + ' mislukt',
                    html: 'Aanmaken Stripe facturen voor ' + account + ' - ' + reference + ' mislukt. <br><br> ' + e.toString(),
                });
                continue;
            }

            if (!result) {
                continue;
            }

            try {
                await onInvoiced?.(account, result.balanceItems);
            } catch (e) {
                // The invoice exists: only the follow-up failed, which needs a different repair
                // (a re-run skips the account because the payment already exists)
                console.error(e);
                Email.sendWebmaster({
                    subject: 'Factuur aangemaakt maar kosten markeren als gefactureerd mislukt voor ' + account + ' - ' + reference,
                    html: 'De factuur voor ' + account + ' - ' + reference + ' is aangemaakt, maar de opgeslagen kosten konden niet gemarkeerd worden als gefactureerd. Een synchronisatie met backfill herstelt dit. <br><br> ' + e.toString(),
                });
            }
        }
    }

    static async hasPayment(sellingOrganization: Organization, reference: string) {
        return !!await Payment.select()
            .where('organizationId', sellingOrganization.id)
            .where('reference', reference)
            .where('status', PaymentStatus.Succeeded)
            .where('method', PaymentMethod.AccountDeductions)
            .where('provider', PaymentProvider.Stripe)
            .first(false);
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
            .where(
                // required because the same organization can have multiple stripe accounts. Null = legacy
                SQL.where('stripeAccountId', stripeAccount.id)
                    .or('stripeAccountId', null),
            )
            .where('reference', reference)
            .where('method', PaymentMethod.AccountDeductions)
            .where('provider', PaymentProvider.Stripe)
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

        const feeBalanceItems: FeeBalanceItems = { serviceFee: null, transferFee: null };

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
            item.VATIncluded = !item.VATExcempt; // Makes sure price with VAT always matches the charged amount
            item.quantity = 1;
            item.unitPrice = applicationFee.serviceFee;
            item.createdAt = new Date();
            item.status = BalanceItemStatus.Hidden;
            item.startDate = this.start;
            item.endDate = this.end;
            await item.save();
            feeBalanceItems.serviceFee = item;
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
            item.VATIncluded = !item.VATExcempt; // Makes sure price with VAT always matches the charged amount
            item.quantity = 1;
            item.unitPrice = applicationFee.transferFee;
            item.createdAt = new Date();
            item.status = BalanceItemStatus.Hidden;
            item.startDate = this.start;
            item.endDate = this.end;
            await item.save();
            feeBalanceItems.transferFee = item;
        }

        const balanceItems = [feeBalanceItems.serviceFee, feeBalanceItems.transferFee].filter(item => item !== null);

        let total = 0;
        for (const balanceItem of balanceItems) {
            total += balanceItem.priceWithVAT;
        }
        if (total !== applicationFee.amount) {
            throw new SimpleError({
                code: 'price_mismatched',
                message: 'The charged amount does not match the total application fee for the payment',
            });
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
            balanceItemPayment.organizationId = payment.organizationId;
            balanceItemPayment.price = balanceItem.priceWithVAT;
            await balanceItemPayment.save();
        }

        await PaymentService.handlePaymentStatusUpdate(payment, sellingOrganization, PaymentStatus.Succeeded, this.start);
        return { payment, balanceItems: feeBalanceItems };
    }
}

export class StripeInvoicer {
    private secretKey: string;

    constructor({ secretKey }: { secretKey: string }) {
        this.secretKey = secretKey;
    }

    static getMonthUnixStartEnd(date: Date) {
        const start = Math.floor((new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime()) / 1000);
        const end = Math.ceil((new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0).getTime() - 1000) / 1000);
        return { start, end };
    }

    // Loops all months until all invoices are generated
    async generateAllInvoices(sellingOrganization: Organization, options?: { force?: boolean; start?: Date; forceLast?: boolean }) {
        const startMonth = options?.start ?? new Date(2026, 0, 1);
        const stopAt = new Date(Date.now() + (STAMHOOFD.environment === 'production' ? (-60 * 60 * 24 * 1000) : (60 * 60 * 24 * 1000 * 31))); // One day margin before creating invoices
        let currentMonth = new Date(startMonth);

        while (true) {
            const { start, end } = StripeInvoicer.getMonthUnixStartEnd(currentMonth);

            if (end >= stopAt.getTime() / 1000) {
                // Stop
                break;
            }
            const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
            const { end: endNext } = StripeInvoicer.getMonthUnixStartEnd(nextMonth);
            const isLastMonth = endNext >= stopAt.getTime() / 1000;
            await this.generateInvoices(sellingOrganization, currentMonth, { ...options, force: (isLastMonth && !!options?.forceLast) || !!options?.force });
            currentMonth = nextMonth;
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

                // Only a complete, error-free fee sync may invoice the month: a missing fee means
                // the month waits (and someone gets an email), never a short invoice
                await new StripeFeeSync({ secretKey: this.secretKey }).syncFees({
                    start: new Date(start * 1000),
                    end: new Date(end * 1000),
                });

                const { report, rowsPerAccount } = await this.buildLocalReport(start, end);
                const invoicer = new StripeReportInvoicer(report, new Date(start * 1000), new Date(end * 1000));

                await invoicer.generateInvoices(sellingOrganization, reference, async (accountId, balanceItems) => {
                    await this.markRowsInvoiced(rowsPerAccount.get(accountId) ?? [], balanceItems);
                });
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

    /**
     * The same report the old code built by scanning the Stripe API, now from the stored Received
     * fee rows grouped per account.
     */
    private async buildLocalReport(startUnix: number, endUnix: number): Promise<{ report: StripeReport; rowsPerAccount: Map<string, SettlementCharge[]> }> {
        const rows = await SettlementCharge.select()
            .where('type', [SettlementChargeType.ReceivedApplicationFeeService, SettlementChargeType.ReceivedApplicationFeeTransfer])
            .where('occurredAt', '>=', new Date(startUnix * 1000))
            .where('occurredAt', '<=', new Date(endUnix * 1000))
            .fetch();

        const accountIds = Formatter.uniqueArray(rows.map(row => row.stripeAccountId)).filter((id): id is string => id !== null);
        if (accountIds.length !== Formatter.uniqueArray(rows.map(row => row.stripeAccountId)).length) {
            throw new SimpleError({
                code: 'missing_stripe_account',
                message: 'Received fee rows without a Stripe account in the invoiced month',
            });
        }
        const accounts = accountIds.length > 0
            ? await StripeAccount.select().where('id', accountIds).fetch()
            : [];

        const report = new StripeReport();
        const rowsPerAccount = new Map<string, SettlementCharge[]>();
        const feeIdsPerAccount = new Map<string, Set<string>>();

        for (const row of rows) {
            const account = accounts.find(a => a.id === row.stripeAccountId);
            if (!account) {
                throw new SimpleError({
                    code: 'stripe_account_not_found',
                    message: 'Stripe account ' + row.stripeAccountId + ' of fee row ' + row.externalId + ' does not exist',
                });
            }

            // The report is keyed on Stripe's acct_… id, like the API scan was
            const accountRows = rowsPerAccount.get(account.accountId) ?? [];
            accountRows.push(row);
            rowsPerAccount.set(account.accountId, accountRows);

            const feeIds = feeIdsPerAccount.get(account.accountId) ?? new Set<string>();
            if (row.applicationFeeId) {
                feeIds.add(row.applicationFeeId);
            }
            feeIdsPerAccount.set(account.accountId, feeIds);

            const details = report.applicationFeesPerAccount.get(account.accountId) ?? new ApplicationFeeDetails({
                serviceFee: 0,
                transferFee: 0,
                minimumDate: null,
                maximumDate: null,
            });
            details.combine(new ApplicationFeeDetails({
                serviceFee: row.type === SettlementChargeType.ReceivedApplicationFeeService ? row.amount : 0,
                transferFee: row.type === SettlementChargeType.ReceivedApplicationFeeTransfer ? row.amount : 0,
                minimumDate: row.occurredAt,
                maximumDate: row.occurredAt,
            }));
            details.count = feeIdsPerAccount.get(account.accountId)!.size;
            report.applicationFeesPerAccount.set(account.accountId, details);
        }

        return { report, rowsPerAccount };
    }

    /**
     * Records for every invoiced fee row which balance item billed it: service rows the ServiceFee
     * item, transfer rows the TransferFee item.
     */
    private async markRowsInvoiced(rows: SettlementCharge[], balanceItems: FeeBalanceItems) {
        for (const row of rows) {
            const item = row.type === SettlementChargeType.ReceivedApplicationFeeService ? balanceItems.serviceFee : balanceItems.transferFee;
            if (!item) {
                throw new SimpleError({
                    code: 'missing_balance_item',
                    message: 'No ' + row.type + ' balance item was created for fee row ' + row.externalId,
                });
            }
            await SettlementService.markInvoiced(row, item.id);
        }
    }
}
