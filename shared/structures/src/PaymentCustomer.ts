import { AutoEncoder, field, StringDecoder, BooleanDecoder } from "@simonbackx/simple-encoding";
import { Company } from "./Company";

/**
 * Who is paying / paid, and how can we contact them
 */
export class PaymentCustomer extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    firstName: string | null = null;
    
    @field({ decoder: StringDecoder, nullable: true })
    lastName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    email: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    phone: string | null = null

    /**
     * As soon as this is set, we can assume that the customer is a company
     */
    @field({ decoder: Company, nullable: true })
    company: Company | null = null

    get name() {
        if (this.firstName && this.lastName) {
            return `${this.firstName} ${this.lastName}`
        }
        
        return this.firstName || this.lastName
    }

    get dynamicName() {
        if (this.company) {
            return this.company.name || this.company.companyNumber || 'Onbekend bedrijf'
        }

        if (this.firstName && this.lastName) {
            return `${this.firstName} ${this.lastName}`
        }
        
        return this.firstName || this.lastName || this.email || this.phone || 'Onbekende klant'
    }

    get dynamicEmail() {
        if (this.company) {
            return this.company.name || this.company.companyNumber || 'Onbekend bedrijf'
        }

        if (this.firstName && this.lastName) {
            return `${this.firstName} ${this.lastName}`
        }
        
        return this.firstName || this.lastName || this.email || this.phone || 'Onbekende klant'
    }
}
