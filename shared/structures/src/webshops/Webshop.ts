import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { DNSRecord, DNSRecordType } from '../DNSRecord';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Organization } from '../Organization';
import { Category } from './Category';
import { Product } from './Product';
import { WebshopMetaData, WebshopPrivateMetaData, WebshopStatus } from './WebshopMetaData';

export class WebshopPreview extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder, version: 134 })
    uri = ""

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder, version: 89, field: "uri" })
    @field({ 
        decoder: StringDecoder, 
        nullable: true, 
        version: 134, 
        downgrade: function(this: Webshop) {
            return this.legacyUri ?? this.uri
        } 
    })
    legacyUri: string | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 89 })
    domain: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 89 })
    domainUri: string | null = null;

    @field({ decoder: WebshopMetaData })
    meta = WebshopMetaData.create({})

    @field({ decoder: WebshopPrivateMetaData, version: 62 })
    privateMeta = WebshopPrivateMetaData.create({})

    get hasSingleTickets() {
        return this.meta.hasSingleTickets
    }

    get hasTickets() {
        return this.meta.hasTickets
    }

    getDefaultDomain(organization: Organization): string  {
        return (STAMHOOFD.domains.webshop[organization.address.country] ?? STAMHOOFD.domains.webshop[""])
    }

    getDefaultUrl(organization: Organization): string {
        return this.getDefaultDomain(organization)+this.getDefaultSuffix()
    }

    getDomainUrl(): string {
        return this.domain+this.getDomainSuffix()
    }

    getUrl(organization: Organization): string {
        if (this.domain && this.meta.domainActive) {
            return this.getDomainUrl()
        }

        return this.getDefaultUrl(organization)
    }

    getCanonicalUrl(organization: Organization): string {
        return (STAMHOOFD.domains.marketing[organization.address.country] ?? STAMHOOFD.domains.marketing[""])+"/"+STAMHOOFD.domains.webshopPrefix+this.getDefaultSuffix()
    }

    getLegacyUrl(organization: Organization): string | null {
        if (this.legacyUri === null) {
            return null
        }
        return organization.uri+"."+STAMHOOFD.domains.legacyWebshop+(this.legacyUri ? "/"+this.legacyUri : "")
    }

    getDomainSuffix(): string {
        if (!this.domainUri) {
            return ""
        }
        return "/"+this.domainUri
    }

    getDefaultSuffix(): string {
        if (!this.uri) {
            return ""
        }
        return "/"+this.uri
    }

    getUrlSuffix(): string {
        if (this.domain) {
            return this.getDomainSuffix()
        }
        return this.getDefaultSuffix()
    }

    isClosed(margin = 0) {
        if (this.meta.status !== WebshopStatus.Open || (this.meta.availableUntil && this.meta.availableUntil.getTime() < new Date().getTime() + margin)) {
            return true
        }
        return false
    }
}

export class Webshop extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder, version: 134 })
    uri = ""

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder, field: "uri"  })
    @field({ 
        decoder: StringDecoder, 
        nullable: true, 
        version: 134, 
        downgrade: function(this: Webshop) {
            return this.legacyUri ?? this.uri
        }
    })
    legacyUri: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    domain: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    domainUri: string | null = null;

    @field({ decoder: WebshopMetaData })
    meta = WebshopMetaData.create({})

    @field({ decoder: new ArrayDecoder(Product) })
    products: Product[] = []

    @field({ decoder: new ArrayDecoder(Category) })
    categories: Category[] = []

    get hasSingleTickets() {
        return this.meta.hasSingleTickets
    }

    get hasTickets() {
        return this.meta.hasTickets
    }

    getDefaultDomain(organization: Organization): string  {
        return (STAMHOOFD.domains.webshop[organization.address.country] ?? STAMHOOFD.domains.webshop[""])
    }

    getDefaultUrl(organization: Organization): string {
        return this.getDefaultDomain(organization)+this.getDefaultSuffix()
    }

    getDomainUrl(): string {
        return this.domain+this.getDomainSuffix()
    }

    getUrl(organization: Organization): string {
        if (this.domain && this.meta.domainActive) {
            return this.getDomainUrl()
        }

        return this.getDefaultUrl(organization)
    }
    
    getCanonicalUrl(organization: Organization): string {
        return (STAMHOOFD.domains.marketing[organization.address.country] ?? STAMHOOFD.domains.marketing[""])+"/"+STAMHOOFD.domains.webshopPrefix+this.getDefaultSuffix()
    }

    getLegacyUrl(organization: Organization): string | null {
        if (this.legacyUri === null) {
            return null
        }
        return organization.uri+"."+STAMHOOFD.domains.legacyWebshop+(this.legacyUri ? "/"+this.legacyUri : "")
    }

    getDomainSuffix(): string {
        if (!this.domainUri) {
            return ""
        }
        return "/"+this.domainUri
    }

    getDefaultSuffix(): string {
        if (!this.uri) {
            return ""
        }
        return "/"+this.uri
    }

    getUrlSuffix(): string {
        if (this.domain) {
            return this.getDomainSuffix()
        }
        return this.getDefaultSuffix()
    }

    buildDNSRecords(): DNSRecord[] {
        if (!this.domain) {
            return []
        }
        return WebshopPrivateMetaData.buildDNSRecords(this.domain)
    }

    isClosed(margin = 0) {
        if (this.meta.status !== WebshopStatus.Open || (this.meta.availableUntil && this.meta.availableUntil.getTime() < new Date().getTime() + margin) || this.opensInTheFuture()) {
            return true
        }
        return false
    }

    opensInTheFuture() {
        if (this.meta.status !== WebshopStatus.Open) {
            return false;
        }
        if (this.meta.openAt && this.meta.openAt.getTime() > new Date().getTime()) {
            return true
        }
        return false
    }
}

export class PrivateWebshop extends Webshop {
    @field({ decoder: WebshopPrivateMetaData })
    privateMeta = WebshopPrivateMetaData.create({})
}

