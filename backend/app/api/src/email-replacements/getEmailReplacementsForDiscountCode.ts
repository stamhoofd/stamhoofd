import { Organization, Webshop, WebshopDiscountCode } from '@stamhoofd/models';
import { Replacement, Webshop as WebshopStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export type DiscountCodeReplacementsOptions = {
    webshopMap: Map<string, Webshop>;
    organizationMap: Map<string, Organization>;
};

export async function buildDiscountCodeReplacementsOptions(discountCodes: WebshopDiscountCode[]): Promise<DiscountCodeReplacementsOptions> {
    const webshopIds = Formatter.uniqueArray(discountCodes.map(code => code.webshopId));
    const webshops = webshopIds.length > 0 ? await Webshop.getByIDs(...webshopIds) : [];
    const webshopMap = new Map(webshops.map(webshop => [webshop.id, webshop] as const));

    const organizationIds = Formatter.uniqueArray(webshops.map(webshop => webshop.organizationId));
    const organizations = organizationIds.length > 0 ? await Organization.getByIDs(...organizationIds) : [];
    const organizationMap = new Map(organizations.map(organization => [organization.id, organization] as const));

    return {
        webshopMap,
        organizationMap,
    };
}

export function getEmailReplacementsForDiscountCode(discountCode: WebshopDiscountCode, options: DiscountCodeReplacementsOptions): Replacement[] {
    const webshop = options.webshopMap.get(discountCode.webshopId);
    const organization = webshop ? options.organizationMap.get(webshop.organizationId) : undefined;
    const webshopStruct = webshop ? WebshopStruct.create(webshop) : null;
    const discountUrl = webshopStruct && organization
        ? 'https://' + webshopStruct.getUrl(organization) + '/code/' + encodeURIComponent(discountCode.code)
        : '';

    return [
        Replacement.create({
            token: 'discountCode',
            value: discountCode.code,
        }),
        Replacement.create({
            token: 'discountUrl',
            value: discountUrl,
        }),
        Replacement.create({
            token: 'webshopName',
            value: webshop?.meta.name ?? '',
        }),
        Replacement.create({
            token: 'organizationName',
            value: organization?.name ?? '',
        }),
    ];
}
