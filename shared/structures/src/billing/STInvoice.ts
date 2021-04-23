import { ArrayDecoder, AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { Address } from "../addresses/Address";
import { File } from "../files/File";
import { Payment } from "../members/Payment";
import { OrganizationSimple } from "../OrganizationSimple";
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
    static fromPackage(pack: STPackage, amount = 1, pendingAmount = 0,  date?: Date): STInvoiceItem {
        let unitPrice = pack.meta.unitPrice

        if (amount < pack.meta.minimumAmount) {
            // Minimum should get applied first, because we might already have paid for the minimum (paid amount)
            amount = pack.meta.minimumAmount
        }

        amount -= pendingAmount
        amount -= pack.meta.paidAmount
        if (amount == 0) {
            amount = 0
        }

        /// When pricing type is memebrs, the price is calculated per year.
        /// If a shorter period is remaining, we give a discount in order
        /// to no need to handle it more complicated
        const now = date ?? new Date()

        if (pack.validUntil) {
            const totalDays = Math.round((pack.validUntil.getTime() - pack.meta.startDate.getTime()) / (1000 * 60 * 60 * 24))
            const remainingDays = Math.round((pack.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

            /// First 3 months are full price
            const paidDays = 30*3

            if (remainingDays > totalDays) {
                throw new Error("Remaining days is larger than total days")
            }

            if (totalDays > 366) {
                // Extended
                throw new Error("Period > 1 year not supported yet")
            } else {
                if (pack.meta.pricingType === STPricingType.PerMember) {
                    unitPrice = Math.min(unitPrice, Math.round(unitPrice * remainingDays / (Math.max(365, totalDays) - paidDays)))
                }
            }
        }

        const item = STInvoiceItem.create({
            name: pack.meta.name,
            description: pack.validUntil ? ("Van "+Formatter.date(now, true)+" tot "+Formatter.date(pack.validUntil, true)) : "",
            package: pack,
            date: now,
            unitPrice: unitPrice,
            amount: amount,
            price: unitPrice * amount
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
    /**
     * This ID is empty for a pending invoice
     */
    @field({ decoder: StringDecoder, nullable: true, optional: true })
    id: string | null = null

    @field({ decoder: Payment, nullable: true })
    payment: Payment | null = null

    @field({ decoder: STInvoiceMeta })
    meta: STInvoiceMeta

    /**
     * If the number is null, no invoice is generated yet. Its still a WIP invoice (not an official one!)
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    number: number | null = null

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null

    @field({ decoder: DateDecoder, nullable: true })
    updatedAt: Date | null = null

    @field({ decoder: DateDecoder, nullable: true })
    paidAt: Date | null = null
}

export class STInvoicePrivate extends STInvoice {
    @field({ decoder: OrganizationSimple, optional: true })
    organization?: OrganizationSimple
}

export class STPendingInvoice extends STInvoice {
    @field({ decoder: StringDecoder, nullable: true, optional: true })
    id: string | null = null

    @field({ decoder: STInvoiceMeta })
    meta: STInvoiceMeta

    @field({ decoder: STInvoice, nullable: true })
    invoice: STInvoice | null = null

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null

    @field({ decoder: DateDecoder, nullable: true })
    updatedAt: Date | null = null
}

export class STPendingInvoicePrivate extends STPendingInvoice {
    @field({ decoder: OrganizationSimple, optional: true })
    organization?: OrganizationSimple
}


export class STInvoiceResponse extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    paymentUrl?: string

    @field({ decoder: STInvoice, optional: true })
    invoice?: STInvoice
}