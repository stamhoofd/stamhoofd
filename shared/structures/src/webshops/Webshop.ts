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
            return this.domain+this.getUrlSuffix()
        }

        return organization.uri+"."+STAMHOOFD.domains.webshop+this.getUrlSuffix()
    }

     getUrlSuffix(): string {
        if (this.domain) {
            if (!this.domainUri) {
                return ""
            }
            return "/"+this.domainUri
        }
        if (!this.uri) {
            return ""
        }
        return "/"+this.uri
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
            return this.domain+this.getUrlSuffix()
        }

        return organization.uri+"."+STAMHOOFD.domains.webshop+this.getUrlSuffix()
    }

    getUrlSuffix(): string {
        if (this.domain) {
            if (!this.domainUri) {
                return ""
            }
            return "/"+this.domainUri
        }
        if (!this.uri) {
            return ""
        }
        return "/"+this.uri
    }

    removeSuffix(url: string[]) {
        const suff = this.getUrlSuffix()
        if (suff.length == 0) {
            return url
        }
        
        if (url[0] && url[0] == suff.substr(1)) {
            return url.slice(1)
        }
        return url
    }
}

export class PrivateWebshop extends Webshop {
    @field({ decoder: WebshopPrivateMetaData })
    privateMeta = WebshopPrivateMetaData.create({})
}

