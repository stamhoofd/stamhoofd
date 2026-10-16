/**
 * More granular access rights to specific things in the system
 */
export enum AccessRight {
    // Platform level permissions
    /**
     * @deprecated
     * Allows the user to log in as a full-access admin to a specific organization
     */
    PlatformLoginAs = 'PlatformLoginAs',

    /**
     * Create new organizations with at least one of the tags this right was granted for
     */
    PlatformCreateOrganizations = 'PlatformCreateOrganizations',

    // Organization level permissions
    OrganizationCreateWebshops = 'OrganizationCreateWebshops',
    OrganizationManagePayments = 'OrganizationManagePayments',
    OrganizationFinanceDirector = 'OrganizationFinanceDirector',
    OrganizationCreateGroups = 'OrganizationCreateGroups',
    EventWrite = 'EventWrite',
    /** defines that this person can review event notification for this organization. You can limit which events by restricing the organizations the user has access to. */
    OrganizationEventNotificationReviewer = 'OrganizationEventNotificationReviewer',

    // Member data access rights
    // Note: in order to read or write any data at all, a user first needs to have normal resource access to a group, category or organization
    // So general data (name, birthday, gender, address, email, parents, emergency contacts) access can be controlled in that way (this doesn't have a separate access right).
    MemberReadFinancialData = 'MemberReadFinancialData',
    MemberWriteFinancialData = 'MemberWriteFinancialData',

    /**
     * Edit/view national registration number
     */
    MemberManageNRN = 'MemberManageNRN',

    // Webshop level permissions
    WebshopScanTickets = 'WebshopScanTickets',

    /**
     * Send messages for a given sender
     */
    SendMessages = 'SendMessages',

    /**
     * Create, edit and delete email templates
     */
    ManageEmailTemplates = 'ManageEmailTemplates',
}
