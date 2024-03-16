import { ArrayDecoder, AutoEncoder,BooleanDecoder,DateDecoder,field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { OpenIDClientConfiguration } from '@stamhoofd/structures';

export class DripEmail extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: DateDecoder })
    date = new Date()
}

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
    
    @field({ decoder: new ArrayDecoder(DateDecoder), optional: true, version: 230 })
    lastInvalidDNSDates?: Date[]

    @field({ decoder: BooleanDecoder, version: 230 })
    isDNSUnstable: boolean = false

    @field({ decoder: StringDecoder, optional: true, version: 86 })
    mollieCustomerId?: string

    @field({ decoder: OpenIDClientConfiguration, nullable: true, version: 189 })
    ssoConfiguration: OpenIDClientConfiguration | null = null

    /**
     * List of specific emails that were send to this organization
     */
    @field({ decoder: new MapDecoder(StringDecoder, DripEmail), optional: true, version: 230, upgrade: () => {
        const m = new Map<string, DripEmail>();
        const identifier = "OrganizationDripWelcome";
        m.set(identifier, DripEmail.create({id: identifier}))
        return m
    } })
    dripEmailList: Map<string, DripEmail> = new Map()

    markDNSValid() {
        // Reset if longer than 14 days without invalid DNS
        this.isDNSUnstable = this.recalculateIsDNSUnstable()
        this.firstInvalidDNSRecords = undefined
    }

    markDNSFailure() {
        if (this.firstInvalidDNSRecords) {
            // Hasn't been valid
            return;
        }
        console.warn("DNS settings became invalid")
        this.firstInvalidDNSRecords = new Date()
        
        // Remove all dates longer than 14 days ago, or more than 6 events
        const d14 = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14)
        const maxLength = 6
        this.lastInvalidDNSDates = [...(this.lastInvalidDNSDates ?? []), new Date()].filter(d => d > d14).slice(0, maxLength);
        this.isDNSUnstable = this.recalculateIsDNSUnstable()
    }

    /**
     * DNS is unstable if it was marked invalid 4 times in the last 2 weeks. Then it stays unstable until there were no invalid DNS moments in the last 2 weeks.
     */
    recalculateIsDNSUnstable() {
        const d14 = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14)
        return (this.lastInvalidDNSDates ?? []).filter(d => d > d14).length > (this.isDNSUnstable ? 0 : 4)
    }

    addEmail(identifier: string) {
        console.log("Marked email ", identifier)
        const email = DripEmail.create({id: identifier})
        this.dripEmailList.set(email.id, email);
    }

    hasEmail(identifier: string, lastMs: number|null = null) {
        if (!this.dripEmailList.has(identifier)) {
            return false;
        }
        if (lastMs === null) {
            return true;
        }
        const email = this.dripEmailList.get(identifier)!;
        return email.date.getTime() > Date.now() - lastMs
    }
}