import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";

import { STInvoice } from "../billing/STInvoice";

function isInvoiceComplete(invoice: STInvoice, payoutExport: StripePayoutExport) {
    // Find all payout items for this invoice
    const payoutItems = payoutExport.payouts.flatMap(p => p.items).filter(i => i.invoices.find(i => i.id === invoice.id))

    // Get total sum of all payout items
    const totalPayout = payoutItems.reduce((total, item) => total + item.amount, 0)

    return totalPayout === invoice.meta.priceWithVAT
}

export enum StripePayoutItemType {
    Invoice = "Invoice",
    StripeFees = "StripeFees",
    StripeReserved = "StripeReserved"
}

export class StripePayoutItem extends AutoEncoder {
    @field({ decoder: StringDecoder})
    name = ""

    @field({ decoder: new EnumDecoder(StripePayoutItemType) })
    type = StripePayoutItemType.Invoice

    @field({ decoder: IntegerDecoder })
    amount = 0

    @field({ decoder: StringDecoder})
    description = ""

    @field({ decoder: new ArrayDecoder(STInvoice)})
    invoices: STInvoice[] = []
}

export class StripePayout extends AutoEncoder {
    @field({ decoder: StringDecoder})
    id: string
    
    @field({ decoder: IntegerDecoder })
    amount = 0

    @field({ decoder: DateDecoder})
    arrivalDate: Date

    @field({ decoder: StringDecoder})
    statementDescriptor = ""
}

export class StripePayoutBreakdown extends AutoEncoder {
    @field({ decoder: StripePayout })
    payout: StripePayout

    @field({ decoder: new ArrayDecoder(StripePayoutItem) })
    items: StripePayoutItem[] = []

    /**
     * Whether the payout amout matches the sum of the items
     */
    get isValid() {
        return this.payout.amount === this.items.reduce((total, item) => total + item.amount, 0)
    }

    isComplete(payoutExport: StripePayoutExport) {
        for (const item of this.items) {
            if (item.type !== StripePayoutItemType.Invoice) {
                continue;
            }

            if (item.invoices.length === 0) {
                return false;
            }

            for (const invoice of item.invoices) {
                if (!isInvoiceComplete(invoice, payoutExport)) {
                    return false;
                }
            }
        }
        return true;
    }
}

export class StripePayoutExport extends AutoEncoder {
    /**
     * All fetched payouts (we need to fetch more payouts than requested in order to complete all information on each invoice, because an invoice might have been paid out in other payouts than requested)
     */
    @field({ decoder: new ArrayDecoder(StripePayoutBreakdown) })
    payouts: StripePayoutBreakdown[] = []

    @field({ decoder: DateDecoder})
    start: Date

    @field({ decoder: DateDecoder})
    end: Date

    get includedPayouts() {
        return this.payouts.filter(p => p.payout.arrivalDate >= this.start && p.payout.arrivalDate <= this.end)
    }

    /**
     * All payouts that only have invoices that are completely paid out in this export
     */
    get completePayouts() {
        return this.includedPayouts.filter(p => p.isComplete(this))
    }

    get totalPaidOut() {
        return this.completePayouts.reduce((total, payout) => total + payout.payout.amount, 0)
    }

    get totalStripeFees() {
        return this.completePayouts.reduce((total, payout) => total + payout.items.filter(i => i.type === StripePayoutItemType.StripeFees).reduce((total, item) => total - item.amount, 0), 0)
    }

    get totalStripeReserved() {
        return this.completePayouts.reduce((total, payout) => total + payout.items.filter(i => i.type === StripePayoutItemType.StripeReserved).reduce((total, item) => total - item.amount, 0), 0)
    }

    get totalInvoices() {
        return this.completePayouts.reduce((total, payout) => total + payout.items.filter(i => i.type === StripePayoutItemType.Invoice).reduce((total, item) => total + item.amount, 0), 0)
    }

    get totalVAT() {
        let VAT = 0;
        for (const payout of this.completePayouts) {
            for (const item of payout.items) {
                if (item.type !== StripePayoutItemType.Invoice) {
                    continue;
                }

                const invoiceVAT = item.invoices.reduce((total, invoice) => total + invoice.meta.VAT, 0)
                const invoiceTotal = item.invoices.reduce((total, invoice) => total + invoice.meta.priceWithVAT, 0)

                if (invoiceTotal === 0) {
                    continue;
                }

                // Calculate applicable VAT based on the amount of the invoice
                VAT += invoiceVAT / invoiceTotal * item.amount
            }
        }
        return Math.round(VAT)
    }

    get net() {
        return this.totalPaidOut - this.totalVAT 
    }

    get isValid() {
        return this.totalPaidOut === this.totalInvoices - this.totalStripeFees && this.completePayouts.length === this.includedPayouts.length
    }
}
