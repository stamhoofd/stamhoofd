import { ArrayDecoder, AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";

import { STInvoice } from "../billing/STInvoice";


export class StripePayoutItem extends AutoEncoder {
    @field({ decoder: StringDecoder})
    name = ""

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
}

export class StripePayoutExport extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(StripePayoutBreakdown) })
    payouts: StripePayoutBreakdown[] = []

    get totalPaidOut() {
        return this.payouts.reduce((total, payout) => total + payout.payout.amount, 0)
    }

    get totalStripeFees() {
        return this.payouts.reduce((total, payout) => total + payout.items.filter(i => i.name === "Stripe Factuur").reduce((total, item) => total + item.amount, 0), 0)
    }

    get totalInvoices() {
        const allInvoices = this.payouts.flatMap(p => p.items.flatMap(i => i.invoices))
        return allInvoices.reduce((total, invoice) => total + invoice.meta.priceWithVAT, 0)
    }

    get totalVAT() {
        const allInvoices = this.payouts.flatMap(p => p.items.flatMap(i => i.invoices))
        return allInvoices.reduce((total, invoice) => total + invoice.meta.VAT, 0)
    }

    get net() {
        return this.totalPaidOut - this.totalVAT 
    }

    get isValid() {
        return this.totalPaidOut === this.totalInvoices - this.totalStripeFees
    }
}
