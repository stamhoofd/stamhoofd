import { AutoEncoder, field, StringDecoder, BooleanDecoder } from '@simonbackx/simple-encoding';
import { Company } from './Company.js';

/**
 * Who is paying / paid, and how can we contact them
 */
export class PaymentCustomer extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    firstName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    lastName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    email: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    phone: string | null = null;

    /**
     * As soon as this is set, we can assume that the customer is a company
     */
    @field({ decoder: Company, nullable: true })
    company: Company | null = null;

    get name() {
        if (this.firstName && this.lastName) {
            return `${this.firstName} ${this.lastName}`;
        }

        return this.firstName || this.lastName;
    }

    get dynamicName() {
        if (this.company) {
            return this.company.name || this.company.companyNumber || $t(`da09fad6-0c65-4d37-8f60-978d6411fbfb`);
        }

        if (this.firstName && this.lastName) {
            return `${this.firstName} ${this.lastName}`;
        }

        return this.firstName || this.lastName || this.email || this.phone || $t(`cc2a07b4-062b-4422-8f11-ecf63d4bac31`);
    }

    get dynamicEmail() {
        return this.email || this.company?.administrationEmail || null;
    }

    equals(other: PaymentCustomer) {
        if (this.firstName !== other.firstName) {
            return false;
        }
        if (this.lastName !== other.lastName) {
            return false;
        }
        if (this.email !== other.email) {
            return false;
        }
        if (this.phone !== other.phone) {
            return false;
        }
        if (!!this.company !== !!other.company) {
            return false;
        }
        if (this.company && other.company) {
            if (!this.company.equals(other.company)) {
                return false;
            }
        }
        return true;
    }
}
