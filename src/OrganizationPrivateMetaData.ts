import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { DNSRecord } from "./DNSRecord"

export class OrganizationPrivateMetaData extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(DNSRecord) })
    dnsRecords: DNSRecord[] = [];
}
