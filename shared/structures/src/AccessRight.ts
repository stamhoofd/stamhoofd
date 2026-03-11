import { PermissionLevel } from './PermissionLevel.js';

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

export class AccessRightHelper {
    static getName(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return $t(`%l4`);
            case AccessRight.OrganizationFinanceDirector: return $t(`%l5`);
            case AccessRight.OrganizationManagePayments: return $t(`%l6`);
            case AccessRight.OrganizationCreateWebshops: return $t(`%l7`);
            case AccessRight.OrganizationCreateGroups: return $t(`%l8`);
            case AccessRight.WebshopScanTickets: return $t(`%Vk`);
            case AccessRight.EventWrite: return $t(`%l9`);
            case AccessRight.OrganizationEventNotificationReviewer: return $t(`%lA`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`%lB`);
            case AccessRight.MemberWriteFinancialData: return $t(`%lC`);

            case AccessRight.MemberManageNRN: return $t(`%lD`);
            case AccessRight.SendMessages: return $t(`%1DA`);
            case AccessRight.ManageEmailTemplates: return $t(`%1DB`);
        }
    }

    static prohibitedOrganizationLevelAccessRights(): AccessRight[] {
        return Object.values(AccessRight).filter(right => AccessRightHelper.autoGrantRightForLevel(right) === null);
    }

    static getNameShort(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return $t(`%Qg`);
            case AccessRight.OrganizationFinanceDirector: return $t(`%tx`);
            case AccessRight.OrganizationManagePayments: return $t(`%MM`);
            case AccessRight.OrganizationCreateWebshops: return $t(`%lE`);
            case AccessRight.OrganizationCreateGroups: return $t(`%lE`);
            case AccessRight.WebshopScanTickets: return $t(`%lF`);
            case AccessRight.EventWrite: return $t(`%uB`);
            case AccessRight.OrganizationEventNotificationReviewer: return $t(`%CV`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`%lG`);
            case AccessRight.MemberWriteFinancialData: return $t(`%lH`);
            case AccessRight.MemberManageNRN: return $t(`%lD`);
            case AccessRight.SendMessages: return $t(`%1DC`);
            case AccessRight.ManageEmailTemplates: return $t(`%1DD`);
        }
    }

    static getDescription(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return $t(`%lI`);
            case AccessRight.OrganizationFinanceDirector: return $t(`%lJ`);
            case AccessRight.OrganizationManagePayments: return $t(`%lK`);
            case AccessRight.OrganizationCreateWebshops: return $t(`%lL`);
            case AccessRight.OrganizationCreateGroups: return $t(`%lM`);
            case AccessRight.WebshopScanTickets: return $t(`%lN`);
            case AccessRight.EventWrite: return $t(`%lO`);
            case AccessRight.OrganizationEventNotificationReviewer: return $t(`%lP`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`%lQ`);
            case AccessRight.MemberWriteFinancialData: return $t(`%lR`);
            case AccessRight.MemberManageNRN: return $t(`%lS`);
            case AccessRight.SendMessages: return $t(`%1DE`);
            case AccessRight.ManageEmailTemplates: return $t(`%1DB`);
        }
    }

    static getLongDescription(right: AccessRight): string | null {
        switch (right) {
            case AccessRight.OrganizationFinanceDirector: return $t(`%lT`);
            case AccessRight.OrganizationManagePayments: return $t(`%lU`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`%lV`);
            case AccessRight.MemberWriteFinancialData: return $t(`%lW`);
            case AccessRight.EventWrite: return $t(`%lX`);
            case AccessRight.MemberManageNRN: return $t(`%lY`);
            case AccessRight.ManageEmailTemplates: return $t(`%1DF`);
        }
        return null;
    }

    /**
     * If a user has a certain permission level, automatically grant the specific access right
     * By default only full permissions gives all access rights, but you can tweak it:
     * E.g., give webshop scan rights if you also have write access to that webshop
     */
    static autoGrantRightForLevel(right: AccessRight): PermissionLevel | null {
        switch (right) {
            case AccessRight.WebshopScanTickets: return PermissionLevel.Write;
            case AccessRight.SendMessages: return PermissionLevel.Write;
            case AccessRight.OrganizationEventNotificationReviewer: return null; // Never granted to full-admins, unless given by the platform
        }
        return PermissionLevel.Full;
    }

    /**
     * Automatically grant a user access rights if they have a certain right
     */
    static autoInheritFrom(right: AccessRight): AccessRight[] {
        switch (right) {
            // Finance director also has manage payments permissions automatically
            case AccessRight.OrganizationManagePayments: return [AccessRight.OrganizationFinanceDirector];

            // Finance director also can view and edit member financial data
            case AccessRight.MemberReadFinancialData: return [AccessRight.OrganizationFinanceDirector, AccessRight.MemberWriteFinancialData];
            case AccessRight.MemberWriteFinancialData: return [AccessRight.OrganizationFinanceDirector];

            // Event notification reviewers automatically have access to events
            case AccessRight.EventWrite: return [AccessRight.OrganizationEventNotificationReviewer];
        }
        return [];
    }
}
