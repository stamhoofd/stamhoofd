import type { LocalizedDomain } from './Localized.js';

// Use `field: type | undefined` instead of `field?: type` to require setting
// each field. This ensures fields are explicitly set to undefined, not
// forgotten to be added.
export type StamhoofdDomains = {
    dashboard: string; // requires both www + non-www DNS record
    registration: LocalizedDomain | undefined; // Optional. Set to undefined for platforms. requires wildcard prefix DNS
    marketing: LocalizedDomain; // main landing page (used for linking back to website, documentation...)
    documentation: LocalizedDomain | undefined; // main landing page (used for linking back to website, documentation...)
    webshop: LocalizedDomain | undefined; // E.g. shop.stamhoofd.be
    legacyWebshop: string | undefined; // In the past, webshops were hosted on a subdomain. This is deprecated, but the links should still work. E.g. stamhoofd.shop for *.stamhoofd.shop
    api: string; // requires wildcard prefix DNS
    rendererApi: string;

    // Scouts & Gidsen Vlaanderen
    sgvLoginUrl: string | undefined;
    sgvAdminUrl: string | undefined;

    // MX + SPF (both for email) + A record for webshops
    webshopCname: string | undefined;

    // MX + SPF (both for email) + A record for registration
    registrationCname: LocalizedDomain;

    // Default email domain for emails sent from organizations
    defaultTransactionalEmail: LocalizedDomain | undefined;
    defaultBroadcastEmail: LocalizedDomain | undefined;
};
