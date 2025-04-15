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
        case PermissionsResourceType.Groups: return plural ? $t(`inschrijvingsgroepen`) : $t(`inschrijvingsgroep`);
        case PermissionsResourceType.GroupCategories: return plural ? $t(`categorieën`) : $t(`categorie`);
        case PermissionsResourceType.OrganizationTags: return plural ? $t(`tags`) : $t(`tag`);
        case PermissionsResourceType.RecordCategories: return plural ? $t(`vragenlijsten`) : $t(`vragenlijst`);
    }
}
