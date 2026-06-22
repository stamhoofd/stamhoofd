import type { LocalizedDomain } from './Localized.js';

export type StamhoofdDomains = {
    dashboard: string; // requires both www + non-www DNS record
    registration?: LocalizedDomain; // Optional. Set to undefined for platforms. requires wildcard prefix DNS
    marketing: LocalizedDomain; // main landing page (used for linking back to website, documentation...)
    documentation?: LocalizedDomain; // main landing page (used for linking back to website, documentation...)
    webshop?: LocalizedDomain; // E.g. shop.stamhoofd.be
    legacyWebshop?: string; // In the past, webshops were hosted on a subdomain. This is deprecated, but the links should still work. E.g. stamhoofd.shop for *.stamhoofd.shop
    api: string; // requires wildcard prefix DNS
    rendererApi: string;
    sgvLoginUrl?: string;
    sgvAdminUrl?: string;

    // MX + SPF (both for email) + A record for webshops
    webshopCname?: string;

    // MX + SPF (both for email) + A record for registration
    registrationCname: LocalizedDomain;

    // Default email domain for emails sent from organizations
    defaultTransactionalEmail?: LocalizedDomain;
    defaultBroadcastEmail?: LocalizedDomain;
};
