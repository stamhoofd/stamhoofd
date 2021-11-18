import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Organization } from '../Organization';
import { Category } from './Category';
import { Product } from './Product';
import { WebshopMetaData, WebshopPrivateMetaData } from './WebshopMetaData';

export class WebshopPreview extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder, version: 89 })
    uri = ""

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder, nullable: true, version: 134 })
    legacyUri: string | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 89 })
    domain: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 89 })
    domainUri: string | null = null;

    @field({ decoder: WebshopMetaData })
    meta = WebshopMetaData.create({})

    @field({ decoder: WebshopPrivateMetaData, version: 62 })
    privateMeta = WebshopPrivateMetaData.create({})

    getUrl(organization: Organization): string {
        if (this.domain) {
            return this.domain+this.getDomainSuffix()
        }

        return (STAMHOOFD.domains.webshop[organization.address.country] ?? STAMHOOFD.domains.webshop[""])+this.getDefaultSuffix()
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
}

export class Webshop extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder })
    uri = ""

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder, nullable: true, version: 134 })
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

    getUrl(organization: Organization): string {
        if (this.domain) {
            return this.domain+this.getDomainSuffix()
        }

        return (STAMHOOFD.domains.webshop[organization.address.country] ?? STAMHOOFD.domains.webshop[""])+this.getDefaultSuffix()
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
}

export class PrivateWebshop extends Webshop {
    @field({ decoder: WebshopPrivateMetaData })
    privateMeta = WebshopPrivateMetaData.create({})
}

