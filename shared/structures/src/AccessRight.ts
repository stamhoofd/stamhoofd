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

    // Member data access rights
    // Note: in order to read or write any data at all, a user first needs to have normal resource access to a group, category or organization
    // So general data (name, birthday, gender, address, email, parents, emergency contacts) access can be controlled in that way (this doesn't have a separate access right).
    MemberReadFinancialData = 'MemberReadFinancialData',
    MemberWriteFinancialData = 'MemberWriteFinancialData',

    /**
     * Edit/view national registration number
     */
    MemberManageNRR = 'MemberManageNRR',

    // Webshop level permissions
    WebshopScanTickets = 'WebshopScanTickets',

    EventWrite = 'EventWrite',
}

export class AccessRightHelper {
    static getName(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return 'Inloggen als hoofdbeheerder';
            case AccessRight.OrganizationFinanceDirector: return 'Toegang tot volledige boekhouding';
            case AccessRight.OrganizationManagePayments: return 'Overschrijvingen beheren';
            case AccessRight.OrganizationCreateWebshops: return 'Webshops maken';
            case AccessRight.OrganizationCreateGroups: return 'Groepen maken';
            case AccessRight.WebshopScanTickets: return 'Tickets scannen';
            case AccessRight.EventWrite: return 'Activiteiten beheren';

            // Member data
            case AccessRight.MemberReadFinancialData: return 'Bekijk rekening leden';
            case AccessRight.MemberWriteFinancialData: return 'Bewerk rekening leden';

            case AccessRight.MemberManageNRR: return 'Rijksregisternummers';
        }
    }

    static getNameShort(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return 'Inloggen';
            case AccessRight.OrganizationFinanceDirector: return 'Boekhouding';
            case AccessRight.OrganizationManagePayments: return 'Overschrijvingen';
            case AccessRight.OrganizationCreateWebshops: return 'Maken';
            case AccessRight.OrganizationCreateGroups: return 'Maken';
            case AccessRight.WebshopScanTickets: return 'Scannen';
            case AccessRight.EventWrite: return 'Activiteiten';

            // Member data
            case AccessRight.MemberReadFinancialData: return 'Lidgeld bekijken';
            case AccessRight.MemberWriteFinancialData: return 'Lidgeld bewerken';
            case AccessRight.MemberManageNRR: return 'Rijksregisternummers';
        }
    }

    static getDescription(right: AccessRight): string {
        switch (right) {
            case AccessRight.PlatformLoginAs: return 'inloggen als hoofdbeheerder';
            case AccessRight.OrganizationFinanceDirector: return 'volledige boekhouding';
            case AccessRight.OrganizationManagePayments: return 'overschrijvingen';
            case AccessRight.OrganizationCreateWebshops: return 'webshops maken';
            case AccessRight.OrganizationCreateGroups: return 'groepen maken';
            case AccessRight.WebshopScanTickets: return 'scannen van tickets';
            case AccessRight.EventWrite: return 'activiteiten beheren';

            // Member data
            case AccessRight.MemberReadFinancialData: return 'Openstaande bedragen bekijken';
            case AccessRight.MemberWriteFinancialData: return 'Openstaande bedragen bewerken';
            case AccessRight.MemberManageNRR: return 'Rijksregisternummers bekijken of bewerken van leden';
        }
    }

    static getLongDescription(right: AccessRight): string | null {
        switch (right) {
            case AccessRight.OrganizationFinanceDirector: return 'Beheerders met deze toegang krijgen toegang tot alle financiële gegevens van de organisatie, en kunnen overschrijvingen als betaald markeren.';
            case AccessRight.OrganizationManagePayments: return 'Beheerders met deze toegang kunnen openstaande overschrijvingen bekijken en markeren als betaald.';

            // Member data
            case AccessRight.MemberReadFinancialData: return 'Bekijk hoeveel een lid precies heeft betaald of nog moet betalen, en bekijk of het lid recht heeft op een verlaagd tarief.';
            case AccessRight.MemberWriteFinancialData: return 'Voeg openstaande bedragen toe of verwijder ze, en pas de betaalstatus van een lid aan.';
            case AccessRight.EventWrite: return 'Maak nieuwe activiteiten aan, verwijder ze en wijzig ze.';
            case AccessRight.MemberManageNRR: return 'Rijksregisternummers bekijken of bewerken van leden.';
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
        }
        return [];
    }
}
