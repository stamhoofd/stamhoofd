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
}

export class AccessRightHelper {
    static getName(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return $t(`Inloggen als hoofdbeheerder`);
            case AccessRight.OrganizationFinanceDirector: return $t(`Toegang tot volledige boekhouding`);
            case AccessRight.OrganizationManagePayments: return $t(`Overschrijvingen beheren`);
            case AccessRight.OrganizationCreateWebshops: return $t(`Webshops maken`);
            case AccessRight.OrganizationCreateGroups: return $t(`Groepen maken`);
            case AccessRight.WebshopScanTickets: return $t(`Tickets scannen`);
            case AccessRight.EventWrite: return $t(`Activiteiten beheren`);
            case AccessRight.OrganizationEventNotificationReviewer: return $t(`Kampmeldingen goedkeuren`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`Bekijk rekening leden`);
            case AccessRight.MemberWriteFinancialData: return $t(`Bewerk rekening leden`);

            case AccessRight.MemberManageNRN: return $t(`Rijksregisternummers`);
        }
    }

    static prohibitedOrganizationLevelAccessRights(): AccessRight[] {
        return Object.values(AccessRight).filter(right => AccessRightHelper.autoGrantRightForLevel(right) === null);
    }

    static getNameShort(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return $t(`Inloggen`);
            case AccessRight.OrganizationFinanceDirector: return $t(`Boekhouding`);
            case AccessRight.OrganizationManagePayments: return $t(`Overschrijvingen`);
            case AccessRight.OrganizationCreateWebshops: return $t(`Maken`);
            case AccessRight.OrganizationCreateGroups: return $t(`Maken`);
            case AccessRight.WebshopScanTickets: return $t(`Scannen`);
            case AccessRight.EventWrite: return $t(`Activiteiten`);
            case AccessRight.OrganizationEventNotificationReviewer: return $t(`Kampmeldingen`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`Lidgeld bekijken`);
            case AccessRight.MemberWriteFinancialData: return $t(`Lidgeld bewerken`);
            case AccessRight.MemberManageNRN: return $t(`Rijksregisternummers`);
        }
    }

    static getDescription(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return $t(`inloggen als hoofdbeheerder`);
            case AccessRight.OrganizationFinanceDirector: return $t(`volledige boekhouding`);
            case AccessRight.OrganizationManagePayments: return $t(`overschrijvingen`);
            case AccessRight.OrganizationCreateWebshops: return $t(`webshops maken`);
            case AccessRight.OrganizationCreateGroups: return $t(`groepen maken`);
            case AccessRight.WebshopScanTickets: return $t(`scannen van tickets`);
            case AccessRight.EventWrite: return $t(`activiteiten beheren`);
            case AccessRight.OrganizationEventNotificationReviewer: return $t(`kampmeldingen goedkeuren`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`Openstaande bedragen bekijken`);
            case AccessRight.MemberWriteFinancialData: return $t(`Openstaande bedragen bewerken`);
            case AccessRight.MemberManageNRN: return $t(`Rijksregisternummers bekijken of bewerken van leden`);
        }
    }

    static getLongDescription(right: AccessRight): string | null {
        switch (right) {
            case AccessRight.OrganizationFinanceDirector: return $t(`Beheerders met deze toegang krijgen toegang tot alle financiële gegevens van de organisatie, en kunnen overschrijvingen als betaald markeren.`);
            case AccessRight.OrganizationManagePayments: return $t(`Beheerders met deze toegang kunnen openstaande overschrijvingen bekijken en markeren als betaald.`);

            // Member data
            case AccessRight.MemberReadFinancialData: return $t(`Bekijk hoeveel een lid precies heeft betaald of nog moet betalen, en bekijk of het lid recht heeft op een verlaagd tarief.`);
            case AccessRight.MemberWriteFinancialData: return $t(`Voeg openstaande bedragen toe of verwijder ze, en pas de betaalstatus van een lid aan.`);
            case AccessRight.EventWrite: return $t(`Maak nieuwe activiteiten aan, verwijder ze en wijzig ze.`);
            case AccessRight.MemberManageNRN: return $t(`Rijksregisternummers bekijken of bewerken van leden.`);
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
