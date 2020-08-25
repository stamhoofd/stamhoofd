import { ArrayDecoder, AutoEncoder, BooleanDecoder,DateDecoder,EnumDecoder,field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';

import { DNSRecord } from "./DNSRecord"
import { OrganizationEmail } from './OrganizationEmail';

export class CreditItem extends AutoEncoder {
    /**
     * Credits in cents
     */
    @field({ decoder: IntegerDecoder })
    change = 0

    /**
     * Credits in cents
     */
    @field({ decoder: DateDecoder })
    date: Date = new Date()

    /**
     * Credits in cents
     */
    @field({ decoder: StringDecoder })
    description: string
}

export enum MollieStatus {
    NeedsData = "NeedsData",
    InReview = "InReview",
    Completed = "Completed"
}

export class MollieOnboarding extends AutoEncoder  {
    @field({ decoder: BooleanDecoder })
    canReceivePayments = false

    @field({ decoder: BooleanDecoder })
    canReceiveSettlements = false

    @field({ decoder: new EnumDecoder(MollieStatus)})
    status: MollieStatus
}

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

    /**
     * Credits in cents
     */
    @field({ decoder: new ArrayDecoder(CreditItem), version: 23 })
    credits: CreditItem[] = []

    // readonly
    @field({ decoder: MollieOnboarding, nullable: true, version: 27})
    mollieOnboarding: MollieOnboarding | null = null
}
