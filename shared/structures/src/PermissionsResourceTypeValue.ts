/**
 * More granular access rights to specific things in the system
 */
export enum PermissionsResourceType {
    Webshops = 'Webshops',
    Groups = 'Groups',
    GroupCategories = 'GroupCategories',
    OrganizationTags = 'OrganizationTags',
    RecordCategories = 'RecordCategory',
    Events = 'Events',

    /**
     * Sending emails and other communication via a sender and viewing the history of sent messages
     */
    Senders = 'Senders',
}
