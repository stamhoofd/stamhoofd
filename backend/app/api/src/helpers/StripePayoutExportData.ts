import type { Invoice, Payment } from '@stamhoofd/models';

export enum StripePayoutItemType {
    Invoice = 'Invoice',
    StripeFees = 'StripeFees',
    StripeReserved = 'StripeReserved',
}

export class StripePayoutItemData {
    name = '';
    type = StripePayoutItemType.Invoice;

    /**
     * In platform price units (1/100 cent)
     */
    amount = 0;
    description = '';

    /**
     * Stripe account id + payment reference: only set for Invoice items, used to group the same
     * account/month combination across multiple payouts.
     */
    accountId: string | null = null;
    reference: string | null = null;

    /**
     * Payments created in the database for these application fees (can be uninvoiced)
     */
    payments: Payment[] = [];

    /**
     * Invoices connected to those payments (only invoices with a number)
     */
    invoices: Invoice[] = [];

    constructor(data: Partial<StripePayoutItemData>) {
        Object.assign(this, data);
    }

    get paymentsTotal() {
        return this.payments.reduce((total, payment) => total + payment.price, 0);
    }

    get hasUninvoicedPayments() {
        return this.payments.some(p => p.invoiceId === null);
    }
}

export class StripePayoutData {
    id: string;
    amount: number; // in platform price units (1/100 cent)
    arrivalDate: Date;
    statementDescriptor: string;

    constructor(data: { id: string; amount: number; arrivalDate: Date; statementDescriptor: string }) {
        this.id = data.id;
        this.amount = data.amount;
        this.arrivalDate = data.arrivalDate;
        this.statementDescriptor = data.statementDescriptor;
    }
}

export class StripePayoutBreakdownData {
    payout: StripePayoutData;
    items: StripePayoutItemData[] = [];

    constructor(data: { payout: StripePayoutData; items?: StripePayoutItemData[] }) {
        this.payout = data.payout;
        this.items = data.items ?? [];
    }

    /**
     * Whether the payout amount matches the sum of the items
     */
    get isValid() {
        return this.payout.amount === this.items.reduce((total, item) => total + item.amount, 0);
    }

    isComplete(payoutExport: StripePayoutExportData) {
        for (const item of this.items) {
            if (item.type !== StripePayoutItemType.Invoice) {
                continue;
            }

            if (!payoutExport.isItemComplete(item)) {
                return false;
            }
        }
        return true;
    }
}

export class StripePayoutExportData {
    /**
     * All fetched payouts (we need to fetch more payouts than requested in order to complete all information,
     * because the fees of a given month might have been paid out in other payouts than the requested ones)
     */
    payouts: StripePayoutBreakdownData[] = [];

    start: Date;
    end: Date;

    constructor(data: { start: Date; end: Date }) {
        this.start = data.start;
        this.end = data.end;
    }

    get includedPayouts() {
        return this.payouts.filter(p => p.payout.arrivalDate >= this.start && p.payout.arrivalDate <= this.end);
    }

    /**
     * All payouts for which all application fees have a matching payment that has been invoiced
     */
    get completePayouts() {
        return this.includedPayouts.filter(p => p.isComplete(this));
    }

    /**
     * An item is complete if all application fees for the account + month are covered by
     * created payments, and all of those payments have been invoiced.
     */
    isItemComplete(item: StripePayoutItemData) {
        if (item.type !== StripePayoutItemType.Invoice) {
            return true;
        }

        if (item.payments.length === 0) {
            return false;
        }

        if (item.hasUninvoicedPayments || item.invoices.length === 0) {
            return false;
        }

        // The sum of the application fees across all fetched payouts should equal the total amount
        // of the created payments for this account + month
        const totalAcrossPayouts = this.payouts
            .flatMap(p => p.items)
            .filter(i => i.accountId === item.accountId && i.reference === item.reference)
            .reduce((total, i) => total + i.amount, 0);

        return totalAcrossPayouts === item.paymentsTotal;
    }

    get totalPaidOut() {
        return this.completePayouts.reduce((total, payout) => total + payout.payout.amount, 0);
    }

    get totalStripeFees() {
        return this.completePayouts.reduce((total, payout) => total + payout.items.filter(i => i.type === StripePayoutItemType.StripeFees).reduce((total, item) => total - item.amount, 0), 0);
    }

    get totalStripeReserved() {
        return this.completePayouts.reduce((total, payout) => total + payout.items.filter(i => i.type === StripePayoutItemType.StripeReserved).reduce((total, item) => total - item.amount, 0), 0);
    }

    get totalInvoices() {
        return this.completePayouts.reduce((total, payout) => total + payout.items.filter(i => i.type === StripePayoutItemType.Invoice).reduce((total, item) => total + item.amount, 0), 0);
    }

    get totalVAT() {
        let VAT = 0;
        for (const payout of this.completePayouts) {
            for (const item of payout.items) {
                if (item.type !== StripePayoutItemType.Invoice) {
                    continue;
                }

                const invoiceVAT = item.invoices.reduce((total, invoice) => total + invoice.VATTotalAmount, 0);
                const invoiceTotal = item.invoices.reduce((total, invoice) => total + invoice.totalWithVAT, 0);

                if (invoiceTotal === 0) {
                    continue;
                }

                // Estimate applicable VAT based on the VAT rate of the connected invoices
                // (an invoice can contain more than only these fees, so we apply the rate, not the absolute amount)
                VAT += invoiceVAT / invoiceTotal * item.amount;
            }
        }
        return Math.round(VAT);
    }

    get net() {
        return this.totalPaidOut - this.totalVAT;
    }

    get isValid() {
        return this.totalPaidOut === this.totalInvoices - this.totalStripeFees - this.totalStripeReserved
            // Aggregate totals can mask payout-level mismatches that cancel each other out
            && this.includedPayouts.every(p => p.isValid)
            && this.completePayouts.length === this.includedPayouts.length;
    }
}
