import { AutoEncoder,BooleanDecoder,DateDecoder,field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

export class OrganizationServerMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    privateDKIMKey?: string

    @field({ decoder: StringDecoder, optional: true })
    publicDKIMKey?: string

    @field({ decoder: StringDecoder, optional: true, version: 24 })
    usedRegisterCode?: string

    /**
     * When the DNS records are invalid for the first time, this timestamp will get set.
     * When DNS is valid again, this will get cleared
     */
    @field({ decoder: DateDecoder, optional: true, version: 37 })
    firstInvalidDNSRecords?: Date

    /**
     * Whether an email has been send to say that the domain is setup correctly
     * Set back to false when changing the domain
     */
    @field({ decoder: BooleanDecoder, optional: true, version: 157 })
    didSendDomainSetupMail = true

    /**
     * When the DNS records are invalid for the first time, this timestamp will get set.
     * When DNS is valid again, this will get cleared
     */
    @field({ decoder: IntegerDecoder, version: 37 })
    DNSRecordWarningCount = 0

    @field({ decoder: StringDecoder, optional: true, version: 86 })
    mollieCustomerId?: string
}