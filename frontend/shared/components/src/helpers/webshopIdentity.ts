import type { Image, Organization, OrganizationMetaData, Webshop, WebshopMetaData } from '@stamhoofd/structures';

/**
 * A webshop only shows its own logo and name when it opted in with `useLogo`: it keeps the logos it
 * had before that, so they may never be read without checking that flag first.
 */
export function getWebshopIdentity(organization: Organization, webshop?: Webshop | null): { metaData: OrganizationMetaData | WebshopMetaData; name: string } {
    if (webshop?.meta.useLogo) {
        return { metaData: webshop.meta, name: webshop.meta.name };
    }
    return { metaData: organization.meta, name: organization.name };
}

/**
 * The square logo of the webshop, or of the organization when the webshop uses the organization logo.
 * A webshop with its own identity never falls back to the organization logo, even when it has no square logo.
 */
export function getWebshopSquareLogo(organization: Organization, webshop?: Webshop | null): { logo: Image; logoDark: Image | null } | null {
    const metaData = getWebshopIdentity(organization, webshop).metaData;
    if (!metaData.squareLogo) {
        return null;
    }
    return { logo: metaData.squareLogo, logoDark: metaData.squareLogoDark };
}
