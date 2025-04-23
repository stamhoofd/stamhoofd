/**
 * More granular access rights to specific things in the system
 */
export enum PermissionsResourceType {
    Webshops = 'Webshops',
    Groups = 'Groups',
    GroupCategories = 'GroupCategories',
    OrganizationTags = 'OrganizationTags',
    RecordCategories = 'RecordCategory',
}

export function getPermissionResourceTypeName(type: PermissionsResourceType, plural = true): string {
    switch (type) {
        case PermissionsResourceType.Webshops: return plural ? 'webshops' : 'webshop';
        case PermissionsResourceType.Groups: return plural ? $t(`2415fc43-835e-4181-b416-6c0fff5db947`) : $t(`b427a2eb-4d55-4f41-b60e-ae3c6819100d`);
        case PermissionsResourceType.GroupCategories: return plural ? $t(`a4ace71b-cafd-414d-8bce-e2f56cb8ebe9`) : $t(`079d3877-b607-4f3b-8139-7f5f4463bd19`);
        case PermissionsResourceType.OrganizationTags: return plural ? $t(`e80487d1-d969-41fe-b2e8-59192e639fbb`) : $t(`fe29857c-e4ac-4b25-aa0e-31813f3570c2`);
        case PermissionsResourceType.RecordCategories: return plural ? $t(`b609c4cb-238c-4b27-bae5-9ee9f307ffb4`) : $t(`2ccc972d-a3a4-4ea4-8a47-20d7b57f035c`);
    }
}
