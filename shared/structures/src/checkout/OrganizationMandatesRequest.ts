import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class OrganizationMandatesRequest extends AutoEncoder {
    /**
     * If not specified, this will use the default organization id
     */
    @field({ decoder: StringDecoder, nullable: true })
    sellingOrganizationId: string | null;
}
