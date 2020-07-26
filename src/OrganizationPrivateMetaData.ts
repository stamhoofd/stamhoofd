import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { DNSRecord } from "./DNSRecord"

export class OrganizationPrivateMetaData extends AutoEncoder {
    /**
     * DNS records that need to be set in order to activate mail domain and registration domain
     */
    @field({ decoder: new ArrayDecoder(DNSRecord), optional: true })
    dnsRecords: DNSRecord[] = [];

    /**
     * Mail domain that is awaiting validation
     */
    @field({ decoder: StringDecoder, nullable: true, optional: true })
    pendingMailDomain: string | null = null

    /**
     * Mail domain that is used to send e-mails. You can't set this directly, the server will set this value as soon as the domain has been validated.
     */
    @field({ decoder: StringDecoder, nullable: true, optional: true })
    mailDomain: string | null = null
}
