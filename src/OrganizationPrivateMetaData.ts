import { ArrayDecoder, AutoEncoder, BooleanDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';

import { DNSRecord } from "./DNSRecord"
import { OrganizationEmail } from './OrganizationEmail';

export class OrganizationPrivateMetaData extends AutoEncoder {
    /**
     * DNS records that need to be set in order to activate mail domain and registration domain
     */
    @field({ decoder: new ArrayDecoder(DNSRecord), version: 6 })
    dnsRecords: DNSRecord[] = [];

    /**
     * Mail domain that is awaiting validation
     */
    @field({ decoder: StringDecoder, nullable: true, version: 6 })
    pendingMailDomain: string | null = null

    /**
     * Mail domain that is used to send e-mails. You can't set this directly, the server will set this value as soon as the domain has been validated.
     */
    @field({ decoder: StringDecoder, nullable: true, version: 6 })
    mailDomain: string | null = null

    @field({ decoder: BooleanDecoder, version: 8 })
    mailDomainActive = false

    /**
     * E-mail addresses that an organization can send from (or reply-to)
     */
    @field({ decoder: new ArrayDecoder(OrganizationEmail), version: 9 })
    emails: OrganizationEmail[] = [];
}
