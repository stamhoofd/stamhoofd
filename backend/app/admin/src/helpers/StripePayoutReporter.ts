import { I18n } from '@stamhoofd/backend-i18n';
import { Email } from '@stamhoofd/email';
import { Organization, STInvoice, StripeAccount } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { STInvoice as STInvoiceStruct,StripePayout, StripePayoutBreakdown, StripePayoutExport, StripePayoutItem, StripePayoutItemType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import Stripe from 'stripe';

import { StripePayoutExportExcel } from './StripePayoutExportExcel';

/**
 * Returns the invoice reference for a given balance item date. So we can group by invoice
 */
const getDateReference = (date: Date) => {
    return 'stripe-fees-' + Formatter.dateIso(getDateStartDate(date))
}

/**
 * Returns the invoice reference for a given balance item date. So we can group by invoice
 */
const getDateStartDate = (date: Date) => {
    // Check timezone is UTC
    if (date.getTimezoneOffset() !== 0) {
        throw new Error("Timezone must be UTC");
    }
    const start = Math.floor((new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime()) / 1000);
    return new Date(start * 1000);
}

export class StripeAccountReport {
    accountId: string
    reference: string

    stripeAccount!: StripeAccount
    organization!: Organization
    invoices: STInvoice[] = []

    constructor(accountId: string, reference: string) {
        this.accountId = accountId;
        this.reference = reference;
    }

    async load() {
        const stripeAccounts = await StripeAccount.where({accountId: this.accountId}, {limit: 1});
        const stripeAccount = stripeAccounts[0];

        if (!stripeAccount) {
            console.error("Stripe account not found for account", this.accountId);
            return
        }

        this.stripeAccount = stripeAccount;

        const organization = await Organization.getByID(stripeAccount.organizationId);

        if (!organization) {
            console.error("Organization not found for account", this.accountId);
            return
        }
        this.organization = organization;

        // Load invoices
        const existingInvoices = (await STInvoice.where({
            organizationId: this.organization.id,
            reference: this.reference
        })).filter(i => i.number !== null && (i.meta.stripeAccountId === this.accountId || i.meta.stripeAccountId === null));
        this.invoices = existingInvoices;
    }
    
    // From Stamhoofd <-> Submerchant
    applicationFees = 0; // to stamhoofd
    applicationFeesRefunded = 0; // to submerchant

    transfers = 0; // to submerchant
    transfersRefunded = 0; // to stamhoofd

    // Customers <-> Stamhoofd account
    charges = 0;
    refunds = 0;
    disputes = 0;

    // Invoiced separately for now (this is not taken from the accounts balance automatically)
    disputeFees = 0;

    minimumDate: Date | null = null;
    maximumDate: Date | null = null;

    get toInvoiceAmount() {
        return this.applicationFees 
            - this.applicationFeesRefunded;
    }

    get notYetInvoicedAmount() {
        return Math.max(0, this.toInvoiceAmount - this.invoices.reduce((total, invoice) => total + invoice.meta.priceWithVAT, 0));
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

    fees = 0
    reserved = 0
}

export class StripeReport {
    accounts: Map<string, StripeAccountReport> = new Map();
    mainAccount: Map<string, StripeMainAccountReport> = new Map();

    check = 0

    async getAccountReport(balanceTransaction: Stripe.BalanceTransaction, accountId: string) {
        const reference = getDateReference(new Date(balanceTransaction.created * 1000));
        const group = reference + '-' + accountId;
        let currentAmount = this.accounts.get(group);
        if (currentAmount === undefined) {
            currentAmount = new StripeAccountReport(accountId, reference)
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
        this.check += balanceTransaction.amount

        if (balanceTransaction.type === 'application_fee') {
            const source = balanceTransaction.source as Stripe.ApplicationFee;
            const account = typeof source.account === 'string' ? source.account : source.account.id;

            if (account) {
                // We don't included refunded fees because these are test payments from test accounts
                const currentAmount = await this.getAccountReport(balanceTransaction, account)
                currentAmount.applicationFees += source.amount;
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));
            } else {
                throw new Error("No account found for application fee " + balanceTransaction.id);
            }

            // Handled
            return;
        }

        if (balanceTransaction.type === 'application_fee_refund') {
            const source = balanceTransaction.source as Stripe.ApplicationFee;
            const account = typeof source.account === 'string' ? source.account : source.account.id;

            if (account) {
                const currentAmount = await this.getAccountReport(balanceTransaction, account)
                currentAmount.applicationFeesRefunded += source.amount;
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));
            } else {
                throw new Error("No account found for refunded application fee " + balanceTransaction.id);
            }

            // Handled
            return;
        }

        // Local payment method = payment, card = charge
        if (balanceTransaction.type === 'payment' || balanceTransaction.type === 'charge') {
            // Use source.destination to get related account id
            const source = balanceTransaction.source as Stripe.Charge;

            if(!source.destination) {
                if (STAMHOOFD.environment !== 'production') {
                    console.error("Unexpected charge on main account without destination account " + balanceTransaction.id);
                    return;
                }

                // This is a charge on the main account
                throw new Error("Unexpected charge on main account without destination account " + balanceTransaction.id);
            }
            const account = typeof source.destination === 'string' ? source.destination : source.destination.id;

            if (account) {
                const currentAmount = await this.getAccountReport(balanceTransaction, account)
                currentAmount.charges += source.amount;
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));

                // Costs on main account
                this.getMainAccountReport(balanceTransaction).fees += balanceTransaction.fee;
            } else {
                throw new Error("No account found for payment " + balanceTransaction.id);
            }

            // Handled
            return;
        }

         // Local payment method = payment_refund, card = refund
        if (balanceTransaction.type === 'payment_refund' || balanceTransaction.type === 'refund') {
            // Use source.destination to get related account id
            const refund = balanceTransaction.source as Stripe.Refund;
            const charge = refund.charge as Stripe.Charge;

            if(!charge) {
                // This is a charge on the main account
                throw new Error("Unexpected refund on main account without charge " + balanceTransaction.id);
            }

            if (!charge.destination) {
                // This is a charge on the main account
                throw new Error("Unexpected refund on main account without destination account " + balanceTransaction.id);
            }

            const account = typeof charge.destination === 'string' ? charge.destination : charge.destination.id;

            if (account) {
                const currentAmount = await this.getAccountReport(balanceTransaction, account)
                currentAmount.refunds += refund.amount;
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));

                // Costs on main account
                this.getMainAccountReport(balanceTransaction).fees += balanceTransaction.fee;
            } else {
                throw new Error("No account found for payment " + balanceTransaction.id);
            }

            // Handled
            return;
        }

        if (balanceTransaction.type === 'transfer') {
            // amount is negative here
            // use source.destination to get related account id

            const source = balanceTransaction.source as Stripe.Transfer;

            if(!source.destination) {
                // This is a charge on the main account
                throw new Error("Unexpected transfer on main account without destination account " + balanceTransaction.id);
            }

            const account = typeof source.destination === 'string' ? source.destination : source.destination.id;

            if (account) {
                const currentAmount = await this.getAccountReport(balanceTransaction, account)
                currentAmount.transfers += -balanceTransaction.amount;
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));
            } else {
                throw new Error("No account found for transfer " + balanceTransaction.id);
            }

            // Handled
            return;
        }

        if (balanceTransaction.type === 'transfer_cancel' || balanceTransaction.type === 'transfer_failure' || balanceTransaction.type === 'transfer_refund') {
            const source = balanceTransaction.source as Stripe.Transfer;

            if(!source.destination) {
                // This is a charge on the main account
                throw new Error("Unexpected transfer refund on main account without destination account " + balanceTransaction.id);
            }

            const account = typeof source.destination === 'string' ? source.destination : source.destination.id;

            if (account) {
                const currentAmount = await this.getAccountReport(balanceTransaction, account)
                currentAmount.transfersRefunded += balanceTransaction.amount;
                currentAmount.addDate(new Date(balanceTransaction.created * 1000));
            } else {
                throw new Error("No account found for transfer refund " + balanceTransaction.id);
            }

            // Handled
            return;
        }

        // Network costs
        if (balanceTransaction.type === 'stripe_fee' || (balanceTransaction.type as any) === 'network_cost') {
            this.getMainAccountReport(balanceTransaction).fees += -balanceTransaction.amount;
            return;
        }

        // Disputes (adjustment)
        if (balanceTransaction.type === 'adjustment') {
            this.getMainAccountReport(balanceTransaction).fees += balanceTransaction.fee;
            const source = balanceTransaction.source 

            if (typeof source === 'string') {
                throw new Error("Received unexpanded source for adjustment " + balanceTransaction.id);
            }

            if (source && source.object === 'dispute') {
                const dispute = balanceTransaction.source as Stripe.Dispute;
                const charge = dispute.charge as Stripe.Charge;

                if (!charge || !charge.destination) {
                    throw new Error("Unexpected dispute without charge or destination " + balanceTransaction.id);
                }
                const account = typeof charge.destination === 'string' ? charge.destination : charge.destination.id;

                if (account) {
                    const currentAmount = await this.getAccountReport(balanceTransaction, account)
                    currentAmount.disputes += -balanceTransaction.amount;
                    currentAmount.addDate(new Date(balanceTransaction.created * 1000));
                    currentAmount.disputeFees += balanceTransaction.fee;
                } else {
                    throw new Error("No account found for dispute " + balanceTransaction.id);
                }
            }

            return;
        }

        if (balanceTransaction.type === 'payout') {
            // Nothing to process
            return;
        }

        if (balanceTransaction.type === 'reserve_transaction') {
            // temporary blocked funds
            this.getMainAccountReport(balanceTransaction).reserved += -balanceTransaction.amount;
            return;
        }

        // Throw an error for types we don't support yet
        throw new Error("Unhandled balance transaction type " + balanceTransaction.type + " " + balanceTransaction.id);
    }
}

export class StripePayoutReport {
    payout: Stripe.Payout;
    report = new StripeReport();
    callback?: () => void;

    constructor(payout: Stripe.Payout) {
        this.payout = payout;
    }

    async build(stripe: Stripe) {
        const report = new StripeReport()
        let c = 0;

        for await (const balanceItem of stripe.balanceTransactions.list({
            payout: this.payout.id, 
            expand: ['data.source.charge'],
            limit: 100
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
    reports: StripePayoutReport[] = [];
    startDate: Date;
    endDate: Date;
    callback?: () => void;

    constructor({secretKey}: { secretKey: string}) {
        this.stripe = new Stripe(secretKey, {apiVersion: '2022-11-15', typescript: true, maxNetworkRetries: 1, timeout: 10000});
    }

    // Loop all payout
    async build(start: Date, end: Date) {
        this.startDate = start;
        this.endDate = end;

        // Also pull in payouts one month before and after, so we don't have any missing data for the requested payouts
        const payoutStartDate = new Date(start.getFullYear(), start.getMonth() - 1, 1, 0, 0, 0, 0);
        const payoutEndDate = new Date(end.getFullYear(), end.getMonth() + 2, 1, 0, 0, 0, 0);

        const params = {
            status: 'paid', 
            expand: [],
            arrival_date: {
                gte: Math.floor(payoutStartDate.getTime() / 1000),
                lte: Math.floor(payoutEndDate.getTime() / 1000),
            }
        };

        const pendingPromises: Promise<void>[] = [];

        for await (const payout of this.stripe.payouts.list(params)) {
            pendingPromises.push(QueueHandler.schedule('stripe-payout-report', async () => {
                console.log('Building report for payout ' + payout.id);
                // Create a report for this payout
                const report = new StripePayoutReport(payout);
                report.callback = this.callback;
                await report.build(this.stripe);
                this.reports.push(report);
            }, 10));
        }

        await Promise.all(pendingPromises);
    }

    async toStructure() {
        // Convert report to Stripe payout export
        const payoutExport = StripePayoutExport.create({
            start: this.startDate,
            end: this.endDate,
        });

        for (const report of this.reports) {
            const breakdown = StripePayoutBreakdown.create({
                payout: StripePayout.create({
                    id: report.payout.id,
                    amount: report.payout.amount,
                    arrivalDate: new Date(report.payout.arrival_date * 1000),
                    statementDescriptor: report.payout.statement_descriptor ?? '/'
                }),
                items: []
            });
            payoutExport.payouts.push(breakdown);

            // Add total costs
            for (const [_, mainAccount] of report.report.mainAccount.entries()) {
                if (mainAccount.fees) {
                    breakdown.items.push(StripePayoutItem.create({
                        name: "Stripe Factuur",
                        type: StripePayoutItemType.StripeFees,
                        amount: -mainAccount.fees,
                        description: mainAccount.description
                    }));    
                }

                if (mainAccount.reserved) {
                    breakdown.items.push(StripePayoutItem.create({
                        name: "Stripe Gereserveerd",
                        type: StripePayoutItemType.StripeReserved,
                        amount: -mainAccount.reserved,
                        description: mainAccount.description
                    }));    
                }
            }

            // Add each individual account
            for (const [id, account] of report.report.accounts) {
                if (account.toInvoiceAmount === 0 && account.invoices.length === 0) {
                    continue;
                }
                const description = (account.organization?.name ?? 'Onbekende vereniging') + ' - ' + (account.minimumDate ? Formatter.dateTime(account.minimumDate) : '?') + ' tot ' + (account.maximumDate ? Formatter.dateTime(account.maximumDate) : '?');
                
                const invoices: STInvoiceStruct[] = [];
                for (const invoice of account.invoices) {
                    invoices.push(await invoice.getStructure());
                }

                breakdown.items.push(StripePayoutItem.create({
                    name: invoices.length === 0 ? 'Nog niet gefactureerd' : ('Factuur ' + invoices.map(i => i.number).join(', ')),
                    type: StripePayoutItemType.Invoice,
                    amount: account.toInvoiceAmount,
                    description,
                    invoices
                }));
            }
        }

        return payoutExport;
    }

    async toExcel(pExport?: StripePayoutExport) {
        // Convert report to Stripe payout export
        const payoutExport = pExport ?? (await this.toStructure());
        const buffer = await StripePayoutExportExcel.export(payoutExport);
        return buffer;
    }

    async sendEmail(): Promise<void> {
        // E-mail the report excel
        const payoutExport = await this.toStructure();
        const buffer = await this.toExcel(payoutExport);
        const startMonth = Formatter.dateWithoutDay(this.startDate, {timezone: 'UTC'});
        const endMonth = Formatter.dateWithoutDay(this.endDate, {timezone: 'UTC'});
        const subject = "Stripe Uitbetalingen " + startMonth + ((endMonth !== startMonth) ? (" - " + endMonth) : '');

        const completePayouts = payoutExport.completePayouts;

        Email.sendInternal({
            to: "hallo@stamhoofd.be",
            subject: subject,
            text: "In bijlage het overzicht van " + Formatter.dateTime(this.startDate) + " tot " + Formatter.dateTime(this.endDate) + ".\n"
                + (payoutExport.isValid ? "" : ("\nRAPPORT ONVOLLEDIG!\n"))
                + "\nTotaal uitbetaald: " + Formatter.price(payoutExport.totalPaidOut) + ` (${completePayouts.length} uitbetalingen)`
                + "\nTotaal Stripe Kosten: " + Formatter.price(payoutExport.totalStripeFees)
                + "\nTotaal gefactureerd: " + Formatter.price(payoutExport.totalInvoices) + " (incl. BTW)"
                + "\nBTW terug te betalen: " + Formatter.price(payoutExport.totalVAT)
                + "\nNetto winst: " + Formatter.price(payoutExport.net)
                + "\n\nOvergeslagen uitbetalingen (onvolledig): " + (payoutExport.payouts.length - completePayouts.length) + "\n",
            type: "transactional",
            attachments: [
                {
                    filename: Formatter.fileSlug(subject) + '.xlsx',
                    content: buffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            ]
        }, new I18n("nl", "BE"))
    }
}