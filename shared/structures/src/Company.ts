import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Address } from './addresses/Address';

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
}
