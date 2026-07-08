import type { EmailInterfaceRecipient } from '@stamhoofd/email';
import { Email } from '@stamhoofd/email';
import { Invoice, Organization, Payment, StripeAccount } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL } from '@stamhoofd/sql';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import Stripe from 'stripe';

import { StripeInvoicer } from './StripeInvoicer.js';
import { StripePayoutBreakdownData, StripePayoutData, StripePayoutExportData, StripePayoutItemData, StripePayoutItemType } from './StripePayoutExportData.js';
import { StripePayoutExportExcel } from './StripePayoutExportExcel.js';
import { passthroughFetch } from './passthroughFetch.js';

/**
 * Returns the payment reference for a given balance item date, matching the references
 * used by StripeInvoicer when creating the payments. So we can group by payment/invoice.
 */
function getDateReference(date: Date) {
    return 'stripe-fees-' + Formatter.dateIso(getDateStartDate(date));
}

/**
 * Returns the start of the month for a given balance item date (same boundaries as StripeInvoicer).
 */
function getDateStartDate(date: Date) {
    const { start } = StripeInvoicer.getMonthUnixStartEnd(date);
    return new Date(start * 1000);
}

/**
 * Convert an amount in Stripe cents to the platform price unit (1/100 cent)
 */
function fromStripeAmount(amount: number) {
    return amount * 100;
}

export class StripeAccountReport {
    accountId: string;
    reference: string;
    sellingOrganization: Organization;

    stripeAccount: StripeAccount | null = null;
    organization: Organization | null = null;
    payments: Payment[] = [];
    invoices: Invoice[] = [];

    constructor(accountId: string, reference: string, sellingOrganization: Organization) {
        this.accountId = accountId;
        this.reference = reference;
        this.sellingOrganization = sellingOrganization;
    }

    async load() {
        const stripeAccount = await StripeAccount.select().where('accountId', this.accountId).first(false);

        if (!stripeAccount) {
            console.error('Stripe account not found for account', this.accountId);
            return;
        }

        this.stripeAccount = stripeAccount;

        const organization = await Organization.getByID(stripeAccount.organizationId);

        if (!organization) {
            console.error('Organization not found for account', this.accountId);
            return;
        }
        this.organization = organization;

        // Load the payments that were created for these application fees (same query as StripeInvoicer uses to check for existing payments)
        this.payments = await Payment.select()
            .where('organizationId', this.sellingOrganization.id)
            .where('payingOrganizationId', organization.id)
            .where(
                // required because the same organization can have multiple stripe accounts. Null = legacy
                SQL.where('stripeAccountId', stripeAccount.id)
                    .or('stripeAccountId', null),
            )
            .where('reference', this.reference)
            .where('method', PaymentMethod.AccountDeductions)
            .where('provider', PaymentProvider.Stripe)
            .where('status', PaymentStatus.Succeeded)
            .fetch();

        // Load the invoices these payments were grouped in (created later by the invoices cron)
        const invoiceIds = Formatter.uniqueArray(this.payments.map(p => p.invoiceId).filter(id => id !== null));
        if (invoiceIds.length > 0) {
            this.invoices = (await Invoice.select().where('id', invoiceIds).fetch())
                .filter(i => i.number !== null);
        }
    }

    // From platform <-> submerchant (in platform price units, 1/100 cent)
    applicationFees = 0; // to platform
    applicationFeesRefunded = 0; // to submerchant

    transfers = 0; // to submerchant
    transfersRefunded = 0; // to platform

    // Customers <-> platform account
    charges = 0;
    refunds = 0;
    disputes = 0;

    minimumDate: Date | null = null;
    maximumDate: Date | null = null;

    get toInvoiceAmount() {
        return this.applicationFees
            - this.applicationFeesRefunded;
    }

    get paymentsTotal() {
        return this.payments.reduce((total, payment) => total + payment.price, 0);
    }

    /**
     * Checks whether all charges that are made on the main account were transferred to the submerchant and leaves no balance on the main account
     */
    get isValid() {
        return this.transfers === this.charges && (this.refunds + this.disputes) === this.transfersRefunded;
    }

    addDate(date: Date) {
        if (!this.minimumDate || date < this.minimumDate) {
            this.minimumDate = date;
        }
        if (!this.maximumDate || date > this.maximumDate) {
            this.maximumDate = date;
        }
    }
}

export class StripeMainAccountReport {
    startDate: Date;

    constructor(startDate: Date) {
        this.startDate = startDate;
    }

    get description() {
        return Formatter.capitalizeFirstLetter(Formatter.dateWithoutDay(this.startDate));
    }

    fees = 0;
    reserved = 0;
}

export class StripeReport {
    sellingOrganization: Organization;
    accounts: Map<string, StripeAccountReport> = new Map();
    mainAccount: Map<string, StripeMainAccountReport> = new Map();

    check = 0;

    constructor(sellingOrganization: Organization) {
        this.sellingOrganization = sellingOrganization;
    }

    async getAccountReport(balanceTransaction: Stripe.BalanceTransaction, accountId: string) {
        const reference = getDateReference(new Date(balanceTransaction.created * 1000));
        const group = reference + '-' + accountId;
        let currentAmount = this.accounts.get(group);
        if (currentAmount === undefined) {
            currentAmount = new StripeAccountReport(accountId, reference, this.sellingOrganization);
            await currentAmount.load();
            this.accounts.set(group, currentAmount);
        }
        return currentAmount;
    }

    getMainAccountReport(balanceTransaction: Stripe.BalanceTransaction) {
        const monthDate = getDateStartDate(new Date(balanceTransaction.created * 1000));
        let currentAmount = this.mainAccount.get(Formatter.dateIso(monthDate));
        if (currentAmount === undefined) {
            currentAmount = new StripeMainAccountReport(monthDate);
            this.mainAccount.set(Formatter.dateIso(monthDate), currentAmount);
        }
        return currentAmount;
    }

    async add(balanceTransaction: Stripe.BalanceTransaction) {
        this.check += fromStripeAmount(balanceTransaction.amount);

        if (balanceTransaction.type === 'application_fee') {
            const source = balanceTransaction.source as Stripe.ApplicationFee;
            const account = typeof source.account === 'string' ? source.account : source.account.id;

            if (account) {
                const currentAmount = await this.getAccountReport(balanceTransaction, account);
                currentAmount.applicationFees += fromStripeAmount(source.amount);
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));
            } else {
                throw new Error('No account found for application fee ' + balanceTransaction.id);
            }

            // Handled
            return;
        }

        if (balanceTransaction.type === 'application_fee_refund') {
            // The source is a fee refund: the connected account is stored on the refunded application fee itself
            const source = balanceTransaction.source as Stripe.FeeRefund;
            const fee = typeof source.fee === 'string' || !source.fee ? null : source.fee;

            if (!fee) {
                throw new Error('Received unexpanded fee for refunded application fee ' + balanceTransaction.id);
            }

            const account = typeof fee.account === 'string' ? fee.account : fee.account.id;

            if (account) {
                const currentAmount = await this.getAccountReport(balanceTransaction, account);
                currentAmount.applicationFeesRefunded += fromStripeAmount(source.amount);
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));
            } else {
                throw new Error('No account found for refunded application fee ' + balanceTransaction.id);
            }

            // Handled
            return;
        }

        // Local payment method = payment, card = charge
        if (balanceTransaction.type === 'payment' || balanceTransaction.type === 'charge') {
            const source = balanceTransaction.source;
            if (typeof source === 'string' || !source) {
                console.error('Unexpected charge', balanceTransaction);
                throw new Error('Received unexpanded source for charge ' + balanceTransaction.id);
            }
            const charge = source as Stripe.Charge;
            const account = charge.on_behalf_of ? (typeof charge.on_behalf_of === 'string' ? charge.on_behalf_of : charge.on_behalf_of.id) : null;

            if (account) {
                const currentAmount = await this.getAccountReport(balanceTransaction, account);
                currentAmount.charges += fromStripeAmount(charge.amount);
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));
                // Costs on main account
                this.getMainAccountReport(balanceTransaction).fees += fromStripeAmount(balanceTransaction.fee);
            } else {
                console.error('Unexpected charge without charge.on_behalf_of', balanceTransaction);
                throw new Error('No account found for charge ' + balanceTransaction.id);
            }

            // Handled
            return;
        }

        // Local payment method = payment_refund, card = refund
        if (balanceTransaction.type === 'payment_refund' || balanceTransaction.type === 'refund') {
            const source = balanceTransaction.source;
            if (typeof source === 'string' || !source) {
                console.error('Unexpected refund', balanceTransaction);
                throw new Error('Received unexpanded source for refund ' + balanceTransaction.id);
            }

            // The source is a refund: the connected account is stored on the refunded charge
            const refund = source as Stripe.Refund;
            const charge = typeof refund.charge === 'string' || !refund.charge ? null : refund.charge;

            if (!charge) {
                console.error('Unexpected refund', balanceTransaction);
                throw new Error('Received unexpanded charge for refund ' + balanceTransaction.id);
            }

            const account = charge.on_behalf_of ? (typeof charge.on_behalf_of === 'string' ? charge.on_behalf_of : charge.on_behalf_of.id) : null;

            if (account) {
                const currentAmount = await this.getAccountReport(balanceTransaction, account);
                currentAmount.refunds += fromStripeAmount(refund.amount);
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));
                // Costs on main account
                this.getMainAccountReport(balanceTransaction).fees += fromStripeAmount(balanceTransaction.fee);
            } else {
                console.error('Unexpected refund without charge.on_behalf_of', balanceTransaction);
                throw new Error('No account found for refund ' + balanceTransaction.id);
            }

            // Handled
            return;
        }

        if (balanceTransaction.type === 'transfer') {
            // amount is negative here
            // use source.destination to get related account id

            const source = balanceTransaction.source as Stripe.Transfer;

            if (!source.destination) {
                // This is a charge on the main account
                throw new Error('Unexpected transfer on main account without destination account ' + balanceTransaction.id);
            }

            const account = typeof source.destination === 'string' ? source.destination : source.destination.id;

            if (account) {
                const currentAmount = await this.getAccountReport(balanceTransaction, account);
                currentAmount.transfers += fromStripeAmount(-balanceTransaction.amount);
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));
            } else {
                throw new Error('No account found for transfer ' + balanceTransaction.id);
            }

            // Handled
            return;
        }

        if (balanceTransaction.type === 'transfer_cancel' || balanceTransaction.type === 'transfer_failure' || balanceTransaction.type === 'transfer_refund') {
            const source = balanceTransaction.source as Stripe.Transfer;

            if (!source.destination) {
                // This is a charge on the main account
                throw new Error('Unexpected transfer refund on main account without destination account ' + balanceTransaction.id);
            }

            const account = typeof source.destination === 'string' ? source.destination : source.destination.id;

            if (account) {
                const currentAmount = await this.getAccountReport(balanceTransaction, account);
                currentAmount.transfersRefunded += fromStripeAmount(balanceTransaction.amount);
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));
            } else {
                throw new Error('No account found for transfer refund ' + balanceTransaction.id);
            }

            // Handled
            return;
        }

        // Network costs
        if (balanceTransaction.type === 'stripe_fee' || (balanceTransaction.type as string) === 'network_cost') {
            this.getMainAccountReport(balanceTransaction).fees += fromStripeAmount(-balanceTransaction.amount);
            return;
        }

        // Disputes (adjustment)
        if (balanceTransaction.type === 'adjustment') {
            this.getMainAccountReport(balanceTransaction).fees += fromStripeAmount(balanceTransaction.fee);
            const source = balanceTransaction.source;

            if (typeof source === 'string') {
                throw new Error('Received unexpanded source for adjustment ' + balanceTransaction.id);
            }

            if (source && source.object === 'dispute') {
                console.error('Unexpected dispute without charge or destination ', balanceTransaction);
                throw new Error('Unexpected dispute without charge or destination ' + balanceTransaction.id);
            }

            return;
        }

        if (balanceTransaction.type === 'payout') {
            // Nothing to process
            return;
        }

        if (balanceTransaction.type === 'reserve_transaction') {
            // temporary blocked funds
            this.getMainAccountReport(balanceTransaction).reserved += fromStripeAmount(-balanceTransaction.amount);
            return;
        }

        // Throw an error for types we don't support yet
        throw new Error('Unhandled balance transaction type ' + balanceTransaction.type + ' ' + balanceTransaction.id);
    }
}

export class StripePayoutReport {
    payout: Stripe.Payout;
    sellingOrganization: Organization;
    report: StripeReport;
    callback?: () => void;

    constructor(payout: Stripe.Payout, sellingOrganization: Organization) {
        this.payout = payout;
        this.sellingOrganization = sellingOrganization;
        this.report = new StripeReport(sellingOrganization);
    }

    async build(stripe: Stripe) {
        const report = new StripeReport(this.sellingOrganization);
        let c = 0;

        for await (const balanceItem of stripe.balanceTransactions.list({
            payout: this.payout.id,
            // charge = for refunds, fee = for application fee refunds
            expand: ['data.source.charge', 'data.source.fee'],
            limit: 100,
        })) {
            await report.add(balanceItem);
            c += 1;

            if (c % 100 === 0) {
                console.log('Processed ' + c + ' balance items');
            }

            if (this.callback) {
                this.callback();
            }
        }

        this.report = report;
    }
}

export class StripePayoutReporter {
    private stripe: Stripe;
    sellingOrganization: Organization;
    reports: StripePayoutReport[] = [];
    startDate: Date = new Date();
    endDate: Date = new Date();
    callback?: () => void;

    constructor({ secretKey, sellingOrganization }: { secretKey: string; sellingOrganization: Organization }) {
        this.stripe = new Stripe(secretKey, {
            apiVersion: '2024-06-20',
            typescript: true,
            maxNetworkRetries: 1,
            timeout: 10000,
            httpClient: STAMHOOFD.environment === 'test'
                ? Stripe.createFetchHttpClient(passthroughFetch)
                : undefined,
        });
        this.sellingOrganization = sellingOrganization;
    }

    // Loop all payouts
    async build(start: Date, end: Date) {
        this.startDate = start;
        this.endDate = end;

        // Also pull in payouts one month before and after, so we don't have any missing data for the requested payouts
        const payoutStartDate = new Date(start.getFullYear(), start.getMonth() - 1, 1, 0, 0, 0, 0);
        const payoutEndDate = new Date(end.getFullYear(), end.getMonth() + 2, 1, 0, 0, 0, 0);

        const params: Stripe.PayoutListParams = {
            status: 'paid',
            arrival_date: {
                gte: Math.floor(payoutStartDate.getTime() / 1000),
                lte: Math.floor(payoutEndDate.getTime() / 1000),
            },
        };

        const pendingPromises: Promise<void>[] = [];

        for await (const payout of this.stripe.payouts.list(params)) {
            pendingPromises.push(QueueHandler.schedule('stripe-payout-report', async () => {
                console.log('Building report for payout ' + payout.id);
                // Create a report for this payout
                const report = new StripePayoutReport(payout, this.sellingOrganization);
                report.callback = this.callback;
                await report.build(this.stripe);
                this.reports.push(report);
            }, 10));
        }

        await Promise.all(pendingPromises);
    }

    toStructure(): StripePayoutExportData {
        // Convert report to Stripe payout export
        const payoutExport = new StripePayoutExportData({
            start: this.startDate,
            end: this.endDate,
        });

        for (const report of this.reports) {
            const breakdown = new StripePayoutBreakdownData({
                payout: new StripePayoutData({
                    id: report.payout.id,
                    amount: fromStripeAmount(report.payout.amount),
                    arrivalDate: new Date(report.payout.arrival_date * 1000),
                    statementDescriptor: report.payout.statement_descriptor ?? '/',
                }),
            });
            payoutExport.payouts.push(breakdown);

            // Add total costs
            for (const mainAccount of report.report.mainAccount.values()) {
                if (mainAccount.fees) {
                    breakdown.items.push(new StripePayoutItemData({
                        name: 'Stripe Factuur',
                        type: StripePayoutItemType.StripeFees,
                        amount: -mainAccount.fees,
                        description: mainAccount.description,
                    }));
                }

                if (mainAccount.reserved) {
                    breakdown.items.push(new StripePayoutItemData({
                        name: 'Stripe Gereserveerd',
                        type: StripePayoutItemType.StripeReserved,
                        amount: -mainAccount.reserved,
                        description: mainAccount.description,
                    }));
                }
            }

            // Add each individual account
            for (const account of report.report.accounts.values()) {
                if (account.toInvoiceAmount === 0 && account.invoices.length === 0 && account.payments.length === 0) {
                    continue;
                }
                const description = (account.organization?.name ?? 'Onbekende vereniging') + ' - ' + (account.minimumDate ? Formatter.dateTime(account.minimumDate) : '?') + ' tot ' + (account.maximumDate ? Formatter.dateTime(account.maximumDate) : '?');

                breakdown.items.push(new StripePayoutItemData({
                    name: this.getAccountItemName(account),
                    type: StripePayoutItemType.Invoice,
                    amount: account.toInvoiceAmount,
                    description,
                    accountId: account.accountId,
                    reference: account.reference,
                    payments: account.payments,
                    invoices: account.invoices,
                }));
            }
        }

        return payoutExport;
    }

    private getAccountItemName(account: StripeAccountReport) {
        if (account.payments.length === 0) {
            return 'Nog geen betaling aangemaakt';
        }

        const numbers = account.invoices.map(i => i.number).filter(n => n !== null);
        if (numbers.length === 0) {
            return 'Betaling aangemaakt, nog niet gefactureerd';
        }

        const name = 'Factuur ' + numbers.join(', ');
        if (account.payments.some(p => p.invoiceId === null)) {
            return name + ' (deels nog niet gefactureerd)';
        }
        return name;
    }

    async toExcel(pExport?: StripePayoutExportData) {
        // Convert report to Stripe payout export
        const payoutExport = pExport ?? this.toStructure();
        const buffer = await StripePayoutExportExcel.export(payoutExport);
        return buffer;
    }

    async sendEmail({ to, extraRecipientsWhenValid }: { to: EmailInterfaceRecipient[]; extraRecipientsWhenValid?: EmailInterfaceRecipient[] }): Promise<void> {
        // E-mail the report excel
        const payoutExport = this.toStructure();
        const buffer = await this.toExcel(payoutExport);
        const startMonth = Formatter.dateWithoutDay(this.startDate, { timezone: 'UTC' });
        const endMonth = Formatter.dateWithoutDay(this.endDate, { timezone: 'UTC' });
        const subject = 'Stripe Uitbetalingen ' + startMonth + ((endMonth !== startMonth) ? (' - ' + endMonth) : '');

        const completePayouts = payoutExport.completePayouts;
        const sellerName = this.sellingOrganization.meta.companies[0]?.name ?? this.sellingOrganization.name;

        Email.send({
            from: Email.getWebmasterFromEmail(),
            to: payoutExport.isValid
                ? [...to, ...(extraRecipientsWhenValid ?? [])]
                : to,
            subject: subject,
            text: 'In bijlage het overzicht van de Stripe uitbetalingen van ' + Formatter.dateTime(this.startDate) + ' tot ' + Formatter.dateTime(this.endDate) + ' voor ' + sellerName + '.\n'
                + (payoutExport.isValid ? '' : ('\nRAPPORT ONVOLLEDIG!\n'))
                + '\nTotaal uitbetaald: ' + Formatter.price(payoutExport.totalPaidOut) + ` (${completePayouts.length} uitbetalingen)`
                + '\nTotaal Stripe Kosten: ' + Formatter.price(payoutExport.totalStripeFees)
                + '\nTotaal doorgefactureerd aan klanten: ' + Formatter.price(payoutExport.totalInvoices) + ' (incl. BTW)'
                + '\nGeschatte BTW terug te betalen: ' + Formatter.price(payoutExport.totalVAT)
                + '\nGeschatte winst: ' + Formatter.price(payoutExport.net)
                + '\n\nOvergeslagen uitbetalingen (onvolledig): ' + (payoutExport.payouts.length - completePayouts.length) + '\n',
            type: 'transactional',
            attachments: [
                {
                    filename: Formatter.fileSlug(subject) + '.xlsx',
                    content: buffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            ],
        });
    }
}
