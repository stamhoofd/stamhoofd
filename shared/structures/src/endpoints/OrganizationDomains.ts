import { AutoEncoder, BooleanDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class OrganizationDomains extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    registerDomain: string | null = null;

    /**
     * Used for sending emails. Use of subdomain is discouraged, because that sends emails from @sub.domain.com instead of @domain.com
     */
    @field({ decoder: StringDecoder, nullable: true })
    mailDomain: string | null = null;

    /**
     * Use shorter DKIM key (1024 bit) instead of 2048 bit
     */
    @field({ decoder: BooleanDecoder, optional: true, version: 177 })
    useDkim1024bit = false;
}
