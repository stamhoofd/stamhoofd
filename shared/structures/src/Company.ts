import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Country } from '@stamhoofd/types/Country';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { Address } from './addresses/Address.js';

export class PeppolEndointId extends AutoEncoder {
    @field({ decoder: StringDecoder })
    schemeID: string;

    @field({ decoder: StringDecoder })
    id: string;
}

export class Company extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
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

    @field({ decoder: PeppolEndointId, nullable: true, version: 399 })
    customPeppolEndpointId: PeppolEndointId | null;

    get peppolEndpointId(): PeppolEndointId | null {
        if (this.customPeppolEndpointId) {
            return this.customPeppolEndpointId;
        }

        return this.peppolCompanyId;
    }

    get peppolCompanyId(): PeppolEndointId | null {
        if (this.address?.country !== Country.Belgium) {
            // Unsupported
            return null;
        }

        const companyNumberOrVAT = this.VATNumber ?? this.companyNumber;

        if (!companyNumberOrVAT) {
            return null;
        }

        const companyNumber = (this.VATNumber ? this.VATNumber.substring(2) : companyNumberOrVAT).replace(/\D+/g, '');

        const id = Formatter.slugVATNumber(companyNumber);

        return PeppolEndointId.create({
            schemeID: '0208', // Belgium
            id,
        });
    }

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
        } else if (!!this.address !== !!other.address) {
            return false;
        }
        if (this.administrationEmail !== other.administrationEmail) {
            return false;
        }
        return true;
    }

    isSameEntity(other: Company) {
        if (this.VATNumber && other.VATNumber) {
            if (Formatter.slugVATNumber(this.VATNumber) === Formatter.slugVATNumber(other.VATNumber)) {
                return true;
            }
            return false;
        }

        if (this.companyNumber && other.companyNumber) {
            if (Formatter.slugVATNumber(this.companyNumber) === Formatter.slugVATNumber(other.companyNumber)) {
                if (this.address && other.address) {
                    // Ignore if different country (only for company numbers)
                    return this.address.country === other.address.country;
                }
                return true;
            }
            return false;
        }

        if (this.address && other.address) {
            if (Formatter.slug(this.name) === Formatter.slug(other.name)) {
                if (this.address.equals(other.address)) {
                    return true;
                }
            }
            return false;
        } else if (!!this.address === !!other.address) {
            return Formatter.slug(this.name) === Formatter.slug(other.name);
        }

        return false;
    }
}
