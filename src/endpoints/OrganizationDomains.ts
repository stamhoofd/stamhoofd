import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class OrganizationDomains extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    registerDomain: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    mailDomain: string | null = null;
}
