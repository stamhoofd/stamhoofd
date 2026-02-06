import { ArrayDecoder, AutoEncoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { DNSRecord } from '../DNSRecord.js';

import { Organization } from '../Organization.js';
import { Category } from './Category.js';
import { Product } from './Product.js';
import { WebshopMetaData, WebshopPrivateMetaData, WebshopStatus } from './WebshopMetaData.js';

export class WebshopPreview extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, version: 378 })
    organizationId = '';

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder, version: 134 })
    uri = '';

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder, version: 89, field: 'uri' })
    @field({
        decoder: StringDecoder,
        nullable: true,
        version: 134,
        downgrade: function (this: Webshop) {
            return this.legacyUri ?? this.uri;
        },
    })
    legacyUri: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 89 })
    domain: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 89 })
    domainUri: string | null = null;

    @field({ decoder: WebshopMetaData })
    meta = WebshopMetaData.create({});

    @field({ decoder: WebshopPrivateMetaData, version: 62 })
    privateMeta = WebshopPrivateMetaData.create({});

    @field({ decoder: DateDecoder, version: 366 })
    createdAt: Date = new Date();

    get hasSingleTickets() {
        return this.meta.hasSingleTickets;
    }

    get hasTickets() {
        return this.meta.hasTickets;
    }

    getDefaultDomain(organization: Organization): string {
        if (!STAMHOOFD.domains.webshop) {
            console.error('No webshop domains configured');
            return '';
        }
        return (STAMHOOFD.domains.webshop[organization.address.country] ?? STAMHOOFD.domains.webshop['']);
    }

    getDefaultUrl(organization: Organization): string {
        return this.getDefaultDomain(organization) + this.getDefaultSuffix();
    }

    getDomainUrl(): string {
        return this.domain + this.getDomainSuffix();
    }

    getUrl(organization: Organization): string {
        if (this.domain && this.meta.domainActive) {
            return this.getDomainUrl();
        }

        return this.getDefaultUrl(organization);
    }

    getLegacyUrl(organization: Organization): string | null {
        if (!STAMHOOFD.domains.legacyWebshop || this.legacyUri === null) {
            return null;
        }
        return organization.uri + '.' + STAMHOOFD.domains.legacyWebshop + (this.legacyUri ? '/' + this.legacyUri : '');
    }

    getDomainSuffix(): string {
        if (!this.domainUri) {
            return '';
        }
        return '/' + this.domainUri;
    }

    getDefaultSuffix(): string {
        if (!this.uri) {
            return '';
        }
        return '/' + this.uri;
    }

    getUrlSuffix(): string {
        if (this.domain) {
            return this.getDomainSuffix();
        }
        return this.getDefaultSuffix();
    }

    isClosed(margin = 0) {
        if (this.meta.status !== WebshopStatus.Open || (this.meta.availableUntil && this.meta.availableUntil.getTime() < new Date().getTime() + margin)) {
            return true;
        }
        return false;
    }
}

export class Webshop extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, version: 378 })
    organizationId = '';

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder, version: 134 })
    uri = '';

    /**
     * Not writeable
     */
    @field({ decoder: StringDecoder, field: 'uri' })
    @field({
        decoder: StringDecoder,
        nullable: true,
        version: 134,
        downgrade: function (this: Webshop) {
            return this.legacyUri ?? this.uri;
        },
    })
    legacyUri: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    domain: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    domainUri: string | null = null;

    @field({ decoder: WebshopMetaData })
    meta = WebshopMetaData.create({});

    @field({ decoder: new ArrayDecoder(Product) })
    products: Product[] = [];

    @field({ decoder: new ArrayDecoder(Category) })
    categories: Category[] = [];

    get hasSingleTickets() {
        return this.meta.hasSingleTickets;
    }

    get hasTickets() {
        return this.meta.hasTickets;
    }

    get productsInOrder() {
        if (this.categories.length > 0) {
            return this.categories.flatMap(category => category.productIds.flatMap((id) => {
                const product = this.products.find(product => product.id === id);
                if (product) {
                    return [product];
                }
                return [];
            }));
        }
        return this.products;
    }

    /**
     * Whether we need to show the text 'Free' in webshops (only if we have at least one non-free product)
     */
    get isAllFree() {
        for (const product of this.products) {
            for (const price of product.prices) {
                if (price.price) {
                    return false;
                }
            }

            for (const menu of product.optionMenus) {
                for (const option of menu.options) {
                    if (option.price) {
                        return false;
                    }
                }
            }
        }

        for (const plan of this.meta.seatingPlans) {
            for (const category of plan.categories) {
                if (category.price) {
                    return false;
                }
            }
        }

        if (this.meta.paymentConfiguration.administrationFee.fixed) {
            return false;
        }

        return true;
    }

    get canEnableCart() {
        if (this.products.length === 1 && !this.meta.allowDiscountCodeEntry) {
            const product = this.products[0];
            if (product.isUnique) {
                return false;
            }
        }
        return true;
    }

    get shouldEnableCart() {
        if (!this.meta.cartEnabled) {
            return false;
        }
        return this.canEnableCart;
    }

    get hasCustomDomain(): boolean {
        return !!this.domain && this.meta.domainActive;
    }

    getDefaultDomain(organization: { address: { country: string } }): string {
        if (!STAMHOOFD.domains.webshop) {
            console.error('No webshop domains configured');
            return '';
        }

        return (STAMHOOFD.domains.webshop[organization.address.country] ?? STAMHOOFD.domains.webshop['']);
    }

    getDefaultUrl(organization: { address: { country: string } }): string {
        return this.getDefaultDomain(organization) + this.getDefaultSuffix();
    }

    getDomainUrl(): string {
        return this.domain + this.getDomainSuffix();
    }

    getUrl(organization: { address: { country: string } }): string {
        if (this.hasCustomDomain) {
            return this.getDomainUrl();
        }

        return this.getDefaultUrl(organization);
    }

    getLegacyUrl(organization: Organization): string | null {
        if (!STAMHOOFD.domains.legacyWebshop || this.legacyUri === null) {
            return null;
        }
        return organization.uri + '.' + STAMHOOFD.domains.legacyWebshop + (this.legacyUri ? '/' + this.legacyUri : '');
    }

    getDomainSuffix(): string {
        if (!this.domainUri) {
            return '';
        }
        return '/' + this.domainUri;
    }

    getDefaultSuffix(): string {
        if (!this.uri) {
            return '';
        }
        return '/' + this.uri;
    }

    getUrlSuffix(): string {
        if (this.domain) {
            return this.getDomainSuffix();
        }
        return this.getDefaultSuffix();
    }

    buildDNSRecords(): DNSRecord[] {
        if (!this.domain) {
            return [];
        }
        return WebshopPrivateMetaData.buildDNSRecords(this.domain);
    }

    isClosed(margin = 0) {
        if (this.meta.status !== WebshopStatus.Open || (this.meta.availableUntil && this.meta.availableUntil.getTime() < new Date().getTime() + margin) || this.opensInTheFuture()) {
            return true;
        }
        return false;
    }

    opensInTheFuture() {
        if (this.meta.status !== WebshopStatus.Open) {
            return false;
        }
        if (this.meta.openAt && this.meta.openAt.getTime() > new Date().getTime()) {
            return true;
        }
        return false;
    }

    clearStock() {
        for (const product of this.products) {
            product.clearStock();
        }

        for (const method of this.meta.checkoutMethods) {
            method.clearStock();
        }
    }
}

export class PrivateWebshop extends Webshop {
    @field({ decoder: WebshopPrivateMetaData })
    privateMeta = WebshopPrivateMetaData.create({});
}
