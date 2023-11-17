import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { Formatter, StringCompare } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { Address } from "../addresses/Address";
import { File } from "../files/File";
import { Payment, Settlement } from "../members/Payment";
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

    @field({ decoder: BooleanDecoder, version: 155 })
    canUseCredits = true

    get price(): number {
        return this.unitPrice * this.amount
    }

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
        let unitPrice = Math.round(pack.meta.unitPrice)

        if (amount < pack.meta.minimumAmount) {
            // Minimum should get applied first, because we might already have paid for the minimum (paid amount)
            amount = pack.meta.minimumAmount
        }

        amount -= pendingAmount
        amount -= pack.meta.paidAmount
        if (amount <= 0) {
            amount = 0
        }

        /// When pricing type is memebrs, the price is calculated per year.
        /// If a shorter period is remaining, we give a discount in order
        /// to no need to handle it more complicated
        let now = date ?? new Date()
        if (now < pack.meta.startDate) {
            // When creating a new package, we sometimes buy it for the future, so use that date instead of now
            now = pack.meta.startDate
        }

        if (pack.validUntil && pack.meta.pricingType !== STPricingType.Fixed) {
            const totalDays = Math.round((pack.validUntil.getTime() - pack.meta.startDate.getTime()) / (1000 * 60 * 60 * 24))
            let remainingDays = Math.round((pack.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

            /// First 3 months are full price
            const paidDays = 30*3

            if (remainingDays > totalDays) {
                remainingDays = totalDays
            }

            if (totalDays > 366) {
                // Increase unit price
                unitPrice = unitPrice * (totalDays/365)
            }

            if (pack.meta.pricingType === STPricingType.PerMember) {
                unitPrice = Math.round(Math.min(unitPrice, unitPrice * remainingDays / (Math.max(365, totalDays) - paidDays)))
            } else {
                unitPrice = Math.round(unitPrice)
            }
        }

        const item = STInvoiceItem.create({
            name: pack.meta.name,
            description: pack.validUntil ? ("Van "+Formatter.date(now, true)+" tot "+Formatter.date(pack.validUntil, true)) : ("Vanaf "+Formatter.date(pack.meta.startDate, true)),
            package: pack,
            date: now,
            unitPrice: unitPrice,
            amount: amount
        })

        return item
    }

    canMerge(other: STInvoiceItem): boolean {
        // Mergeable if both don't have a packege, or both have the same package
        if (other.package && !this.package) {
            return false
        }
        if (!other.package && this.package) {
            return false
        }
        if (other.package && this.package && other.package.id !== this.package.id) {
            return false
        }
        if (this.name === other.name) {
            if (this.unitPrice === other.unitPrice && this.description === other.description) {
                return true
            }
        }
        return false
    }

    merge(other: STInvoiceItem): void {
        this.amount += other.amount

        // Other package will be more up to date
        this.package = other.package
    }

    /// Only compress an invoice when it is marked as paid and for a pending invoice when it doesn't has an invoice
    /// Else you'll lose the ID's!
    static compress(items: STInvoiceItem[]) {
        const copy = items.slice()

        for (let index = 0; index < copy.length; index++) {
            // Create a copy to prevent changing the original one
            const item = STInvoiceItem.create(copy[index]);
            copy[index] = item

            // Loop further (in reverse order to be able to delete items)
            for (let j = copy.length - 1; j > index; j--) {
                const other = copy[j]
                if (item.canMerge(other)) {
                    // Delete other
                    item.merge(other)
                    copy.splice(j, 1)
                }
            }
        }
        return copy
    } 
}

export class STInvoiceMeta extends AutoEncoder {
    /**
     * Date the invoice was valid and given a number. 
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

    /**
     * Sometimes we need to calculate an invoice in reverse when we have a fixed price including VAT,
     * but need to calculatle the price excluding VAT.
     */
    @field({ decoder: BooleanDecoder, version: 186 })
    areItemsIncludingVAT = false

    // Cached company information (in case it is changed)
    @field({ decoder: StringDecoder })
    companyName: string

    @field({ decoder: StringDecoder })
    companyContact: string

    @field({ decoder: Address })
    companyAddress: Address

    @field({ decoder: StringDecoder, nullable: true })
    companyVATNumber: string | null = null

    @field({ decoder: StringDecoder, nullable: true, optional: true })
    companyNumber: string | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 133 })
    ipAddress: string | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 133 })
    userAgent: string | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 210 })
    stripeAccountId: string | null = null

    /**
     * Depending on areItemsIncludingVAT, this can either be including or excluding VAT
     */
    private get itemPrice() {
        return this.items.reduce((price, item) => price + item.price, 0)
    }

    includingVATToExcludingVAT(price: number) {
        // Always only round the VAT, not other prices
        return price - this.getVATOnIncludingVATAmount(price)
    }

    excludingVATToIncludingVAT(price: number) {
        // Always only round the VAT, not other prices
        return price + this.getVATOnExcludingVATAmount(price)
    }

    getVATOnIncludingVATAmount(price: number) {
        return Math.round(price  * this.VATPercentage / (100 + this.VATPercentage))
    }

    getVATOnExcludingVATAmount(price: number) {
        return Math.round(this.itemPrice * this.VATPercentage / 100)
    }

    get priceWithoutVAT(): number {
        const itemPrice = this.itemPrice
        if (this.areItemsIncludingVAT) {
            return itemPrice - this.VAT
        }
        return itemPrice
    }

    get VAT(): number {
        if (this.areItemsIncludingVAT) {
            // Subtract VAT and round
            return this.getVATOnIncludingVATAmount(this.itemPrice)
        }

        return this.getVATOnExcludingVATAmount(this.itemPrice)
    }

    get priceWithVAT(): number {
        const itemPrice = this.itemPrice
        if (this.areItemsIncludingVAT) {
            return itemPrice
        }
        return itemPrice + this.VAT
    }
}

export class STInvoice extends AutoEncoder {
    /**
     * This ID is empty for a pending invoice
     */
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

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

    @field({ decoder: Settlement, nullable: true })
    settlement: Settlement | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 186 })
    reference: string | null = null

    matchQuery(query: string) {
        if (query === this.number?.toString() || query === this.id) {
            return true
        }

        if (
            StringCompare.typoCount(this.meta.companyName, query) < 2 ||
            StringCompare.typoCount(this.meta.companyAddress.city, query) < 2 ||
            StringCompare.typoCount(this.meta.companyContact, query) < 2 ||
            (this.meta.companyVATNumber && StringCompare.typoCount(this.meta.companyVATNumber, query) < 2) ||
            StringCompare.typoCount(this.meta.companyAddress.street, query) < 2
        ) {
            return true;
        }

        if (!this.organization) {
            return false
        }
    
        if (
            StringCompare.typoCount(this.organization.name, query) < 2 ||
            StringCompare.typoCount(this.organization.address.city, query) < 2 ||
            StringCompare.typoCount(this.organization.address.street, query) < 2 ||
            StringCompare.typoCount(this.meta.companyName, query) < 2 ||
            StringCompare.typoCount(this.meta.companyName, query) < 2
        ) {
            return true;
        }
        return false;
    }
}

export class STPendingInvoice extends AutoEncoder {
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