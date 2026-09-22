import type { Organization, OrganizationMetaData, Webshop, WebshopMetaData } from '@stamhoofd/structures';

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
