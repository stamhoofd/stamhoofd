/**
 * More granular access rights to specific things in the system
 */
export enum PermissionsResourceType {
    Webshops = "Webshops",
    Groups = "Groups",
    GroupCategories = "GroupCategories",
    OrganizationTags = "OrganizationTags",
    RecordCategories = "RecordCategory"
}

export function getPermissionResourceTypeName(type: PermissionsResourceType, plural = true): string {
    switch (type) {
        case PermissionsResourceType.Webshops: return plural ? 'webshops' : 'webshop';
        case PermissionsResourceType.Groups: return plural ? 'inschrijvingsgroepen' : 'inschrijvingsgroep';
        case PermissionsResourceType.GroupCategories: return plural ? 'categorieën' : 'categorie';
        case PermissionsResourceType.OrganizationTags: return plural ? 'tags' : 'tag';
        case PermissionsResourceType.RecordCategories: return plural ? 'vragenlijsten' : 'vragenlijst';
    }
}
