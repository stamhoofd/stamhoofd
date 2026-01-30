import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Address } from './addresses/Address.js';

export class Company extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Legal name of the organization (optional)
     */
    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder, nullable: true })
    VATNumber: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    companyNumber: string | null = null;

    @field({ decoder: Address, nullable: true })
    address: Address | null = null;

    @field({ decoder: StringDecoder, nullable: true, optional: true })
    administrationEmail: string | null = null;

    getDiffValue() {
        return this.name;
    }

    equals(other: Company) {
        if (this.name !== other.name) {
            return false;
        }
        if (this.VATNumber !== other.VATNumber) {
            return false;
        }
        if (this.companyNumber !== other.companyNumber) {
            return false;
        }
        if (this.address && other.address) {
            if (!this.address.equals(other.address)) {
                return false;
            }
        }
        else if (!!this.address !== !!other.address) {
            return false;
        }
        if (this.administrationEmail !== other.administrationEmail) {
            return false;
        }
        return true;
    }
}
