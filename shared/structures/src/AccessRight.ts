import { PermissionLevel } from './PermissionLevel.js';

/**
 * More granular access rights to specific things in the system
 */
export enum AccessRight {
    // Platform level permissions
    /**
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
}

export class AccessRightHelper {
    static getName(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return $t(`cb0fa3c3-98ea-4d10-bf33-0efc813ffe0b`);
            case AccessRight.OrganizationFinanceDirector: return $t(`f595a8e8-fb33-4187-aa3c-99745f6f4c1b`);
            case AccessRight.OrganizationManagePayments: return $t(`5b0b7566-408d-43d5-863b-cd4d5c36f945`);
            case AccessRight.OrganizationCreateWebshops: return $t(`426ce9af-e807-4604-a3be-95b6359fdff3`);
            case AccessRight.OrganizationCreateGroups: return $t(`36688810-b154-437a-b46c-39e879ce20c4`);
            case AccessRight.WebshopScanTickets: return $t(`213bb888-16d4-4cdc-b917-6e6ec8b6fc84`);
            case AccessRight.EventWrite: return $t(`a56e84d7-d324-4d2d-b3d2-1f890280c6ac`);
            case AccessRight.OrganizationEventNotificationReviewer: return $t(`b1713243-3ede-4818-b67d-01f83154776f`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`e6f62cf2-96c8-41dc-a142-d2c49a0a45f3`);
            case AccessRight.MemberWriteFinancialData: return $t(`5043355f-40a8-4291-b1f9-9645cea7ac3b`);

            case AccessRight.MemberManageNRN: return $t(`bdf22e21-e4f9-4561-b750-0ea06d73c2f4`);
            case AccessRight.SendMessages: return $t(`Berichten versturen`);
        }
    }

    static prohibitedOrganizationLevelAccessRights(): AccessRight[] {
        return Object.values(AccessRight).filter(right => AccessRightHelper.autoGrantRightForLevel(right) === null);
    }

    static getNameShort(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return $t(`1627a32a-56b8-4c74-8715-b885c1795af6`);
            case AccessRight.OrganizationFinanceDirector: return $t(`5d5cb596-1b5b-4ec3-98dd-2c0f012d9093`);
            case AccessRight.OrganizationManagePayments: return $t(`6c58724b-afce-40a4-b11d-a6f6b86976b9`);
            case AccessRight.OrganizationCreateWebshops: return $t(`f3de2983-5c64-4653-b2c5-62c94eb3d04f`);
            case AccessRight.OrganizationCreateGroups: return $t(`f3de2983-5c64-4653-b2c5-62c94eb3d04f`);
            case AccessRight.WebshopScanTickets: return $t(`ca94a7e0-afaa-4076-9340-4620fb034d8d`);
            case AccessRight.EventWrite: return $t(`d9b4472a-a395-4877-82fd-da6cb0140594`);
            case AccessRight.OrganizationEventNotificationReviewer: return $t(`caf486c6-818a-4d2b-9fdb-728c6af71481`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`8d64ab67-da1d-4143-8c6c-94ade8e1823f`);
            case AccessRight.MemberWriteFinancialData: return $t(`da4a7e62-2f98-4e87-89f5-d3643e7bb987`);
            case AccessRight.MemberManageNRN: return $t(`bdf22e21-e4f9-4561-b750-0ea06d73c2f4`);
            case AccessRight.SendMessages: return $t(`Versturen`);
        }
    }

    static getDescription(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return $t(`b90c0b36-7e1d-416a-b37a-79ef7ddb8b87`);
            case AccessRight.OrganizationFinanceDirector: return $t(`f696b984-f946-4a68-83f9-0fa02c75873d`);
            case AccessRight.OrganizationManagePayments: return $t(`97f33d05-54af-4568-a932-4dac4530417f`);
            case AccessRight.OrganizationCreateWebshops: return $t(`0c38c5f1-da3a-40fe-881a-7e59841001cd`);
            case AccessRight.OrganizationCreateGroups: return $t(`435c36bb-c708-481b-acf0-b8b271be406f`);
            case AccessRight.WebshopScanTickets: return $t(`327cec8c-06c2-46c5-81b6-7d2e6cf8cf90`);
            case AccessRight.EventWrite: return $t(`439560b9-68f9-437f-9297-bcb2a64fa972`);
            case AccessRight.OrganizationEventNotificationReviewer: return $t(`a8ca5719-4e3b-4e46-a64d-f3f16a35a864`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`bcf9d463-8536-40ae-8e7e-a4c36e793dbc`);
            case AccessRight.MemberWriteFinancialData: return $t(`e3f2e800-1918-459d-aa79-ce6c8833bb53`);
            case AccessRight.MemberManageNRN: return $t(`ef892736-b403-4eb5-8e59-662ffbfd1c54`);
            case AccessRight.SendMessages: return $t(`Inclusief eigen berichten bekijken`);
        }
    }

    static getLongDescription(right: AccessRight): string | null {
        switch (right) {
            case AccessRight.OrganizationFinanceDirector: return $t(`a1f2f6e4-7f12-4fa2-abd8-40fb59e8ff9a`);
            case AccessRight.OrganizationManagePayments: return $t(`885aa405-e8e4-4dff-a57d-ab967b6ca31e`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`d87cd793-80a1-4e57-8086-64abdd8e88f3`);
            case AccessRight.MemberWriteFinancialData: return $t(`a821c56c-e5de-4505-83ca-25d8a74d3c19`);
            case AccessRight.EventWrite: return $t(`f84ae947-6023-4ddd-ae90-93422290494b`);
            case AccessRight.MemberManageNRN: return $t(`746b82e0-dfe4-4091-89e1-d2f28659e6f9`);
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
