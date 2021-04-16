import { AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors";
import { v4 as uuidv4 } from "uuid";

import { Address } from "../addresses/Address";


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

    @field({ decoder: new EnumDecoder(STPackageType) })
    type: STPackageType

    @field({ decoder: new EnumDecoder(STPricingType) })
    pricingType = STPricingType.Fixed

    @field({ decoder: IntegerDecoder })
    price = 0

    /// Contains the invoiced amount. Not the paid amount
    @field({ decoder: IntegerDecoder })
    amount = 1

    /**
     * Only used if applicable
     */
    @field({ decoder: BooleanDecoder })
    autorenew = true

    /// If a top up is done, and the payment fails, set the date here
    /// + increase the payment failed count.
    /// After x days this will disable all functions if it keeps failing
    @field({ decoder: DateDecoder, nullable: true })
    lastFailedPayment: Date | null = null
    
    @field({ decoder: IntegerDecoder })
    paymentFailedCount = 0

    get totalPrice() {
        return this.price * this.amount
    }
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

    /// validAt is null if the initial needed payment is missing. The package can be ignored
    /// This is the case during a payment
    @field({ decoder: DateDecoder, nullable: true })
    validAt: Date | null = null

    /// After this date, show messages that a renew is required
    // if null: no renew allowed
    @field({ decoder: DateDecoder, nullable: true })
    renewAt: Date | null = null

    /// Disable all features after this day
    /// If this is set, a warning will be visible a couple of days before
    /// If you don't want the warning, only use removeAt
    @field({ decoder: DateDecoder, nullable: true })
    disableAt: Date | null = null

    /// Disable / delete this package after this date (also no renew allowed). Can't keep using the currently saved pricing
    @field({ decoder: DateDecoder, nullable: true })
    removeAt: Date | null = null

    createStatus(): STPackageStatus {
        return STPackageStatus.create(this)
    }
}



export class STPackageStatus extends AutoEncoder {
    /// After this date, show messages that a renew is required, but keep module active
    // if null: no renew allowed
    @field({ decoder: DateDecoder, nullable: true })
    renewAt: Date | null = null

    /// Disable all features after this day
    /// If this is set, a warning will be visible a couple of days before
    /// If you don't want the warning, only use removeAt
    @field({ decoder: DateDecoder, nullable: true })
    disableAt: Date | null = null

    /// Disable / delete this package after this date (also no renew allowed). Can't keep using the currently saved pricing
    @field({ decoder: DateDecoder, nullable: true })
    removeAt: Date | null = null

    get isActive() {
        const d = new Date()

        if (this.removeAt && this.removeAt < d) {
            return false
        }

        if (this.disableAt && this.disableAt < d) {
            return false
        }

        return true
    }

    merge(status: STPackageStatus) {
        if (status.renewAt === null) {
            this.renewAt = null
        } else if (this.renewAt !== null) {
            if (status.renewAt > this.renewAt) {
                this.renewAt = status.renewAt
            }
        }

        if (status.disableAt === null) {
            this.disableAt = null
        } else if (this.disableAt !== null) {
            if (status.disableAt > this.disableAt) {
                this.disableAt = status.disableAt
            }
        }

        if (status.removeAt === null) {
            this.removeAt = null
        } else if (this.removeAt !== null) {
            if (status.removeAt > this.removeAt) {
                this.removeAt = status.removeAt
            }
        }
    }
}

export function calculateVATPercentage(address: Address, VATNumber: string | null) {
    // Determine VAT rate
    let VATRate = 0
    if (address.country === "BE") {
        VATRate = 21
    } else {
        if (VATNumber) {
            VATRate = 0
        } else {
            // Apply VAT rate of the home country for consumers in the EU

            if (address.country === "NL") {
                VATRate = 21;
            } else {
                throw new SimpleError({
                    code: "country_not_supported",
                    message: "Non-business sales to your country are not yet supported. Please enter a valid VAT number.",
                })
            }
        }
    }
    return VATRate
}