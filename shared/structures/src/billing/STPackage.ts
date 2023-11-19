import { AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors";
import { v4 as uuidv4 } from "uuid";

import { Address } from "../addresses/Address";
import { Country } from "../addresses/CountryDecoder";


export enum STPackageType {
    // Members without activities (not available in frontend anymore)
    "LegacyMembers" = "LegacyMembers",

    // Full members package
    "Members" = "Members",

    // Webshop package (max 10 webshops)
    "Webshops" = "Webshops",

    // One webshop package (max 1 webshop)
    "SingleWebshop" = "SingleWebshop",

    "TrialMembers" = "TrialMembers",
    "TrialWebshops" = "TrialWebshops",
}

export class STPackageTypeHelper {
    static getName(type: STPackageType): string {
        switch (type) {
            case STPackageType.LegacyMembers: return "Ledenadministratie zonder activiteiten";
            case STPackageType.Members: {
                return "Ledenadministratie, per lid";
            }
            case STPackageType.Webshops: {
                return "Webshop module. Maximaal 10 webshops";
            }
            case STPackageType.SingleWebshop: {
                return "Webshop module voor één webshop";
            }
            case STPackageType.TrialMembers: return "Demo ledenadministratie";
            case STPackageType.TrialWebshops: return "Demo webshops";
        }
    }
}

export enum STPricingType {
    "Fixed" = "Fixed", 

    /**
     * Package is renewable per year
     * Package can get extended initially to a specific date
     */
    "PerYear" = "PerYear", 

    /**
     * Price is per member, per year
     */
    "PerMember" = "PerMember",
}

export class STPackageMeta extends AutoEncoder {
    get name(): string {
        return STPackageTypeHelper.getName(this.type)
    }

    /**
     * ID of the package that was renewed (if it was renewed)
     */
    @field({ decoder: StringDecoder, optional: true })
    didRenewId?: string

    @field({ decoder: new EnumDecoder(STPackageType) })
    type: STPackageType

    @field({ decoder: new EnumDecoder(STPricingType) })
    pricingType = STPricingType.Fixed

    @field({ decoder: IntegerDecoder })
    unitPrice = 0

    /// Contains the (paid) invoiced amount
    @field({ decoder: IntegerDecoder })
    paidAmount = 0

    /// Contains the (paid) invoiced price. Used for statistics and reporting
    @field({ decoder: IntegerDecoder })
    paidPrice = 0

    /**
     * Minimum amount that will needs to get invoiced. Only used for first invoice
     */
    @field({ decoder: IntegerDecoder })
    minimumAmount = 1

    /**
     * Only used if applicable
     */
    @field({ decoder: BooleanDecoder })
    autorenew = true

    /**
     * Only used if applicable
     */
    @field({ decoder: BooleanDecoder })
    allowRenew = false

    /// If a top up is done, and the payment fails, set the date here
    /// + increase the payment failed count.
    /// After x days this will disable all functions if it keeps failing
    @field({ decoder: DateDecoder, nullable: true })
    firstFailedPayment: Date | null = null
    
    @field({ decoder: IntegerDecoder })
    paymentFailedCount = 0

    /**
     * Date when the package starts. Is is valid until validUntil
     */
    @field({ decoder: DateDecoder })
    startDate: Date

    @field({ decoder: BooleanDecoder })
    canDeactivate = false
}

/**
 * A package contains a price agreement for a given period that might be renewable
 */
export class STPackage extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string
    
    @field({ decoder: STPackageMeta })
    meta: STPackageMeta

    @field({ decoder: DateDecoder })
    createdAt = new Date()

    @field({ decoder: DateDecoder })
    updatedAt = new Date()

    /** 
     * validAt is null if the initial needed payment is missing. The package can be ignore
     * It contains the date when the package was validated and added correctly.
     */
    @field({ decoder: DateDecoder, nullable: true })
    validAt: Date | null = null

    @field({ decoder: DateDecoder, nullable: true })
    validUntil: Date | null = null

    /// Disable / delete this package after this date (also no renew allowed). Can't keep using the currently saved pricing
    @field({ decoder: DateDecoder, nullable: true })
    removeAt: Date | null = null

    shouldHintRenew() {
        if (!this.meta.allowRenew || this.validUntil === null) {
            return false
        }

        if (this.meta.startDate > new Date()) {
            // Not yet activated
            return false;
        }

        // Allow renew 6 months in advance
        const allowAfter = new Date(this.validUntil)
        allowAfter.setDate(allowAfter.getDate() - 31 * 6)

        if (allowAfter < new Date()) {
            return true
        }
        return false
    }
}

export class STPackageStatus extends AutoEncoder {
    @field({ decoder: DateDecoder })
    startDate: Date

    @field({ decoder: DateDecoder, nullable: true })
    validUntil: Date | null = null

    /// Disable / delete this package after this date (also no renew allowed). Can't keep using the currently saved pricing
    @field({ decoder: DateDecoder, nullable: true })
    removeAt: Date | null = null

    @field({ decoder: DateDecoder, nullable: true })
    firstFailedPayment: Date | null = null

    get isActive() {
        const d = new Date()

        /// Active if it starts within 10 seconds (fixes time differences between server and clients)
        if (this.startDate && this.startDate > new Date(d.getTime() + 10 * 1000)) {
            return false
        }

        if (this.removeAt && this.removeAt < d) {
            return false
        }

        if (this.validUntil && this.validUntil < d) {
            return false
        }

        // Deactivate module if payment failed, and not reactivated after 4 weeks
        const expire = new Date()
        expire.setDate(expire.getDate() - 28)
        if (this.firstFailedPayment && this.firstFailedPayment < expire) {
            return false
        }

        return true
    }

    /**
     * Purchased the package, the package is not yet removed, but it is expired or not paid after 4 weeks following a failed payment
     */
    get wasActive() {
        if (this.isActive) {
            return false;
        }
        
        const d = new Date()

        /// Active if it starts within 10 seconds (fixes time differences between server and clients)
        if (this.startDate && this.startDate > new Date(d.getTime() + 10 * 1000)) {
            return false
        }

        if (this.removeAt && this.removeAt < d) {
            return false
        }

        if (this.validUntil && this.validUntil < d) {
            // Passed!
            return true
        }

        // Deactivate module if payment failed, and not reactivated after 4 weeks
        const expire = new Date()
        expire.setDate(expire.getDate() - 28)
        if (this.firstFailedPayment && this.firstFailedPayment < expire) {
            // did not pay!
            return true
        }

        return false
    }

    get deactivateDate(): Date | null {
        const dates: Date[] = []
        if (this.removeAt !== null) {
            dates.push(this.removeAt)
        }

        if (this.validUntil !== null) {
            dates.push(this.validUntil)
        }

        if (this.firstFailedPayment !== null) {
            const expire = new Date(this.firstFailedPayment)
            expire.setDate(expire.getDate() + 28)
            dates.push(expire)
        }

        if (dates.length == 0) {
            return null
        }

        return new Date(Math.min(...dates.map(d => d.getTime())))
    }

    merge(status: STPackageStatus) {
        if (status.startDate < this.startDate) {
            this.startDate = status.startDate
            // TODO: fix behaviour with gaps if we allow that in the future
        }

        if (status.validUntil === null) {
            this.validUntil = null
        } else if (this.validUntil !== null) {
            if (status.validUntil > this.validUntil) {
                this.validUntil = status.validUntil
            }
        }

        if (status.removeAt === null) {
            this.removeAt = null
        } else if (this.removeAt !== null) {
            if (status.removeAt > this.removeAt) {
                this.removeAt = status.removeAt
            }
        }

        if (this.firstFailedPayment === null) {
            this.firstFailedPayment = status.firstFailedPayment
        } else if (status.firstFailedPayment !== null) {
            if (status.firstFailedPayment < this.firstFailedPayment) {
                this.firstFailedPayment = status.firstFailedPayment
            }
        }
    }
}

export function calculateVATPercentage(address: Address, VATNumber: string | null) {
    // Determine VAT rate
    let VATRate = 0
    if (address.country === Country.Belgium) {
        VATRate = 21
    } else {
        if (VATNumber && VATNumber.substr(0, 2).toUpperCase() != "BE") {
            VATRate = 0
        } else {
            // Apply VAT rate of the home country for consumers in the EU

            switch( address.country) {
                case Country.Netherlands: VATRate = 21; break;
                case Country.Luxembourg: VATRate = 17; break;
                case Country.France: VATRate = 20; break;
                case Country.Germany: VATRate = 19; break;
                default: {
                    throw new SimpleError({
                        code: "country_not_supported",
                        message: "Non-business sales to your country are not yet supported. Please enter a valid VAT number.",
                    })
                }
            }
        }
    }
    return VATRate
}