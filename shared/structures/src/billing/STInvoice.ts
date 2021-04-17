import { ArrayDecoder, AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { Address } from "../addresses/Address";
import { File } from "../files/File";
import { STPackage, STPackageTypeHelper, STPricingType } from "./STPackage";

export enum STInvoiceStatus {
    Created = "Created",
    Prepared = "Prepared",
    Completed = "Completed",
    Canceled = "Canceled",
}

export class STInvoiceItem extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: IntegerDecoder })
    amount = 1

    @field({ decoder: IntegerDecoder })
    unitPrice = 0

    @field({ decoder: IntegerDecoder })
    price = 0

    /** 
     * All data of the original package that is linked to this item
     */ 
    @field({ decoder: STPackage, optional: true })
    package?: STPackage
    
    /**
     * Date the item was created/bought
     */
    @field({ decoder: DateDecoder, optional: true })
    date?: Date

    /** 
     * Convertable into STInvoiceItem (or the diffence if amount is increased)
     * Use this to calculate prices or create an invoice
     * This will calculate the price to expand the package to the given amount.
     * If you want to renew a package, you need to create a new package first
     */
    static fromPackage(pack: STPackage, amount = 1, date?: Date): STInvoiceItem {
        let unitPrice = pack.meta.unitPrice

        if (amount < pack.meta.minimumAmount) {
            amount = pack.meta.minimumAmount
        }

        /// When pricing type is memebrs, the price is calculated per year.
        /// If a shorter period is remaining, we give a discount in order
        /// to no need to handle it more complicated
        
        let remainingMonths: number | undefined
        const now = date ?? new Date()

        if (pack.validUntil) {
            // On average a month is 30.5 days in a leap year, so we use that to calculate the remaining months
            // Note: the date that should get passed is the day of the beginning of the month when we check at the end of the month

            // We first calculate the remaining days (rounded down), then the months (rounded)
            let remainingMonths = Math.round(Math.floor((pack.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) / 30.5)

            if (remainingMonths >= 10) {
                /// First 3 months are full price, without discounts
                remainingMonths = Math.max(remainingMonths, 12)
            }
        }

        if (pack.meta.pricingType === STPricingType.PerMember && remainingMonths) {
            unitPrice = Math.round(unitPrice * remainingMonths / 12)
        }

        const item = STInvoiceItem.create({
            name: pack.meta.name,
            description: pack.validUntil ? ("Van "+Formatter.date(now, true)+" tot "+Formatter.date(pack.validUntil, true)) : "",
            package: pack,
            date: now,
            unitPrice: unitPrice,
            amount: amount - pack.meta.paidAmount,
            price: unitPrice * (amount - pack.meta.paidAmount)
        })

        return item
    }
}

export class STInvoiceMeta extends AutoEncoder {
    /**
     * Date the invoice was created. 
     */
    @field({ decoder: DateDecoder, optional: true })
    date?: Date

    /**
     * Only set if the invoice is officially generated and send
     */
    @field({ decoder: File, optional: true })
    pdf?: File

    /**
     * VATPercentage should be zero in countries outside Belgium in EU
     */
    @field({ decoder: IntegerDecoder})
    VATPercentage = 21

    @field({ decoder: new ArrayDecoder(STInvoiceItem) })
    items: STInvoiceItem[] = []

    // Cached company information (in case it is changed)
    @field({ decoder: StringDecoder })
    companyName: string

    @field({ decoder: Address })
    companyAddress: Address

    @field({ decoder: StringDecoder, nullable: true })
    companyVATNumber: string | null = null

    get priceWithoutVAT(): number {
        return this.items.reduce((price, item) => price + item.price, 0)
    }

    get VAT(): number {
        return Math.round(this.priceWithoutVAT * this.VATPercentage / 100)
    }

    get priceWithVAT(): number {
        return this.priceWithoutVAT + this.VAT
    }
}

export class STInvoice extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder, nullable: true })
    paymentId: string | null = null

    @field({ decoder: STInvoiceMeta })
    meta: STInvoiceMeta

    /**
     * If the number is null, no invoice is generated yet. Its still a WIP invoice (not an official one!)
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    number: number | null

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null

    @field({ decoder: DateDecoder, nullable: true })
    updatedAt: Date | null = null

    @field({ decoder: DateDecoder, nullable: true })
    paidAt: Date | null = null
}

export class STInvoiceResponse extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    paymentUrl?: string

    @field({ decoder: STInvoice, optional: true })
    invoice?: STInvoice
}