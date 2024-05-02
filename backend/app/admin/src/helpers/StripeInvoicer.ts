import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { Email } from '@stamhoofd/email';
import { Organization, STInvoice, StripeAccount } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { calculateVATPercentage, Country, STInvoiceItem, STInvoiceMeta } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import Stripe from 'stripe';

export class ApplicationFeeDetails {
    amount = 0
    count = 0;
    minimumDate: Date | null = null
    maximumDate: Date | null = null

    constructor(details: { count?: number, amount: number, minimumDate: Date | null, maximumDate: Date | null}) {
        this.count = details.count ?? 0
        this.amount = details.amount
        this.minimumDate = details.minimumDate
        this.maximumDate = details.maximumDate
    }

    static fromStripe(transaction: Stripe.BalanceTransaction) {
        return new ApplicationFeeDetails({
            count: 1,
            amount: transaction.amount,
            minimumDate: new Date(transaction.created * 1000),
            maximumDate: new Date(transaction.created * 1000)
        })
    }

    add(fee: Stripe.BalanceTransaction) {
        this.combine(ApplicationFeeDetails.fromStripe(fee))
    }

    remove(fee: Stripe.BalanceTransaction) {
        this.combine(ApplicationFeeDetails.fromStripe(fee))
    }

    combine(other: ApplicationFeeDetails) {
        this.amount += other.amount
        this.count += other.count
        if (other.minimumDate && (this.minimumDate === null || other.minimumDate < this.minimumDate)) {
            this.minimumDate = other.minimumDate
        }
        if (other.maximumDate && (this.maximumDate === null || other.maximumDate > this.maximumDate)) {
            this.maximumDate = other.maximumDate
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
                // We don't included refunded fees because these are test payments from test accounts
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
    start: Date
    end: Date
    
    constructor(report: StripeReport, start: Date, end: Date) {
        this.report = report;
        this.start = start
        this.end = end
    }

    async generateInvoices(reference: string) {
        const invoices: STInvoice[] = [];
        for (const [account, details] of this.report.applicationFeesPerAccount) {
            try {
                const invoice = await this.generateInvoice(reference, account, details);
                if (invoice) {
                    invoices.push(invoice);
                }
            } catch (e) {
                console.error(e);
                // Send email notification of this error
                Email.sendInternal({
                    subject: 'Aanmaken Stripe facturen voor ' + account + " - " + reference + ' mislukt',
                    to: 'hallo@stamhoofd.be',
                    html: 'Aanmaken Stripe facturen voor ' + account + " - " + reference + ' mislukt. <br><br> ' + e.toString()
                }, new I18n('nl', Country.Belgium));
            }
        }
        return invoices;
    }

    static async hasInvoice(reference: string) {
        const existingInvoices = await STInvoice.where({
            reference: reference,
            number: { sign: "!=", value: null }
        }, {limit: 1});

        return existingInvoices.length > 0;
    }

    async generateInvoice(reference: string, accountId: string, applicationFee: ApplicationFeeDetails) {
        if (applicationFee.amount === 0) {
            return;
        }

        // Search for the organization in Stamhoofd
        const stripeAccounts = await StripeAccount.where({accountId}, {limit: 1});
        if (stripeAccounts.length !== 1) {
            if (STAMHOOFD.environment === 'test') {
                console.error('No organization found for Stripe account ' + accountId);
                return
            }
            throw new SimpleError({
                code: 'stripe_account_not_found',
                message: 'No organization found for Stripe account ' + accountId,
            })
        }

        const stripeAccount = stripeAccounts[0];
        const organization = await Organization.getByID(stripeAccount.organizationId);

        if (!organization) {
            throw new SimpleError({
                code: 'organization_not_found',
                message: 'No organization found for Stripe account ' + accountId,
            })
        }

        const existingInvoices = await STInvoice.where({
            organizationId: organization.id,
            reference: reference,
        });
        for (const i of existingInvoices) {
            if (i.number) {
                if (!i.meta.stripeAccountId && i.meta.priceWithVAT === applicationFee.amount) {
                    i.meta.stripeAccountId = accountId;

                    console.log('Set stripe account id for invoice ' + i.number + ' to ' + accountId)
                    await i.save();
                }

                if (!i.meta.stripeAccountId) {
                    throw new SimpleError({
                        code: 'invoice_already_exists_with_different_amount',
                        message: 'Invoice without account id already exists with different amount ' + organization.id + ' expected ' + applicationFee.amount + ' got ' + i.meta.priceWithVAT + ' in invoice ' + i.number,
                    })
                }

                if (i.meta.stripeAccountId === accountId) {
                    if (i.meta.priceWithVAT !== applicationFee.amount) {
                        throw new SimpleError({
                            code: 'invoice_already_exists_with_different_amount',
                            message: 'Invoice already exists with different amount ' + organization.id + ' expected ' + applicationFee.amount + ' got ' + i.meta.priceWithVAT + ' in invoice ' + i.number,
                        })
                    }

                    // Already invoiced
                    console.warn('Tried to invoice an already invoiced.')
                    return;
                }
            }

            // Can ignore these and keep them
        }

        const invoice = new STInvoice();
        invoice.organizationId = organization.id;
        invoice.reference = reference;
        invoice.meta = STInvoiceMeta.create({
            companyName: organization.meta.companyName ?? organization.name,
            companyContact: organization.privateMeta.billingContact ?? "",
            companyAddress: organization.meta.companyAddress ?? organization.address,
            companyVATNumber: organization.meta.VATNumber,
            VATPercentage: calculateVATPercentage(organization.meta.companyAddress ?? organization.address, organization.meta.VATNumber),
            areItemsIncludingVAT: true,
            stripeAccountId: accountId
        })
        
        invoice.meta.items.push(STInvoiceItem.create({
            name: "Transactiekosten via Stripe",
            description: `Voor ${applicationFee.count} online betalingen op Stripe Account ${accountId} tussen ${Formatter.dateTime(this.start)} en ${Formatter.dateTime(this.end)}. Stamhoofd houdt automatisch de transactiekosten in van je Stripe balans.`,
            amount: 1,
            unitPrice: applicationFee.amount
        }))

        if (invoice.meta.priceWithVAT !== applicationFee.amount) {
            throw new Error("Calculated VAT is not the same as the amount in the report")
        }

        await invoice.save();
        await invoice.markPaid({sendEmail: false});
        return invoice;
    }
}

export class StripeInvoicer {
    private stripe: Stripe;

    constructor({secretKey}: { secretKey: string}) {
        this.stripe = new Stripe(secretKey, {apiVersion: '2022-11-15', typescript: true, maxNetworkRetries: 1, timeout: 10000});
    }

    static getMonthUnixStartEnd(date: Date) {
        const start = Math.floor((new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime()) / 1000);
        const end = Math.ceil((new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0).getTime() - 1000) / 1000);
        return {start, end};
    }

    // Loops all months until all invoices are generated
    async generateAllInvoices(options?: {force?: boolean, start?: Date}) {
        const startMonth = options?.start ?? new Date(2023, 8 - 1, 1);
        const stopAt = new Date(Date.now() - 60 * 60 * 24 * 1000); // One day margin before creating invoices
        let currentMonth = new Date(startMonth)
        
        // eslint-disable-next-line no-constant-condition
        while(true) {
            const {start, end} = StripeInvoicer.getMonthUnixStartEnd(currentMonth);

            if (end >= stopAt.getTime() / 1000) {
                // Stop
                break;
            }
            await this.generateInvoices(currentMonth, options);
            currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        }
    }

    async generateInvoices(month: Date, options?: {force?: boolean}) {
        const {start, end} = StripeInvoicer.getMonthUnixStartEnd(month);
        const reference = 'stripe-fees-' + Formatter.dateIso(new Date(start * 1000));

        try {
            await QueueHandler.schedule(reference, async () => {
                if (!options?.force && await StripeReportInvoicer.hasInvoice(reference)) {
                    console.log('Already invoiced month', reference);
                    return;
                }

                console.log('Generating invoices for ', reference, start, end);
                const reportFees = await this.fetchBalanceItems({
                    created: {
                        gte: start,
                        lte: end
                    },
                    type: 'application_fee',
                    expand: ['data.source'],
                    limit: 100
                })
                const reportRefund = await this.fetchBalanceItems({
                    created: {
                        gte: start,
                        lte: end
                    },
                    type: 'application_fee_refund',
                    expand: ['data.source.fee'],
                    limit: 100
                })

                const report = reportFees.combine(reportRefund)
                const invoicer = new StripeReportInvoicer(report, new Date(start * 1000), new Date(end * 1000));
                await invoicer.generateInvoices(reference);
            });
        } catch (e) {
            console.error(e);

            // Send email notification of this error
            Email.sendInternal({
                subject: 'Aanmaken Stripe facturen voor ' + Formatter.dateNumber(month) + ' mislukt',
                to: 'hallo@stamhoofd.be',
                html: 'Aanmaken Stripe facturen voor ' + Formatter.dateNumber(month) + ' mislukt. <br><br> ' + e.toString()
            }, new I18n('nl', Country.Belgium));
        }
    }

    private async fetchBalanceItems(options: Stripe.BalanceTransactionListParams) {
        // For the given payout, fetch all balance items
        const params = {...options};
        const report = new StripeReport()

        for await (const balanceItem of this.stripe.balanceTransactions.list(params)) {
            report.add(balanceItem);
        }

        return report;
    }
}