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
 * The square logo of the webshop, or of the organization when the webshop has no logo of its own.
 * A webshop with only a horizontal logo has no square logo: the organization's would show a different identity.
 */
export function getWebshopSquareLogo(organization: Organization, webshop?: Webshop | null): { logo: Image; logoDark: Image | null } | null {
    const metaData = webshop?.meta.useLogo && (webshop.meta.squareLogo || webshop.meta.horizontalLogo) ? webshop.meta : organization.meta;
    if (!metaData.squareLogo) {
        return null;
    }
    return { logo: metaData.squareLogo, logoDark: metaData.squareLogoDark };
}
