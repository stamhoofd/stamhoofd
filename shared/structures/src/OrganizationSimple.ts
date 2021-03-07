import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { Address } from './addresses/Address';

export class OrganizationSimple extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    /**
     * Name of the organization you are creating
     */
    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: Address })
    address: Address;
}