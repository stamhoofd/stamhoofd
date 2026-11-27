import { AuditLogType, getAuditLogTypeName } from '@stamhoofd/structures';

/**
 * Where audit logs are shown. Some names and categories depend on it.
 */
export type AuditLogTypeContext = {
    isPlatform: boolean;
    /**
     * True for the log of a single organization, false for the admin panel.
     */
    isOrganizationLog: boolean;
};

/**
 * The order of the values is the order in which the categories are shown.
 */
export enum AuditLogTypeCategory {
    Members = 'Members',
    Responsibilities = 'Responsibilities',
    PlatformMemberships = 'PlatformMemberships',
    Registrations = 'Registrations',
    Groups = 'Groups',
    Events = 'Events',
    Webshops = 'Webshops',
    Payments = 'Payments',
    Emails = 'Emails',
    Users = 'Users',
    Documents = 'Documents',
    Organizations = 'Organizations',
    Settings = 'Settings',
    Other = 'Other',
}

/**
 * Order in which audit log types are listed within their category: new, changed and deleted
 * objects, with related types next to each other.
 */
export const auditLogTypeOrder: AuditLogType[] = [
    AuditLogType.MemberAdded,
    AuditLogType.MemberEdited,
    AuditLogType.MemberDeleted,

    AuditLogType.MemberResponsibilityRecordAdded,
    AuditLogType.MemberResponsibilityRecordEdited,
    AuditLogType.MemberResponsibilityRecordDeleted,

    AuditLogType.MemberPlatformMembershipAdded,
    AuditLogType.MemberPlatformMembershipEdited,
    AuditLogType.MemberPlatformMembershipDeleted,

    AuditLogType.MemberRegistered,
    AuditLogType.MemberUnregistered,
    AuditLogType.RegistrationInvitationAdded,
    AuditLogType.RegistrationInvitationDeleted,

    AuditLogType.GroupAdded,
    AuditLogType.GroupEdited,
    AuditLogType.GroupDeleted,
    AuditLogType.WaitingListAdded,
    AuditLogType.WaitingListEdited,
    AuditLogType.WaitingListDeleted,

    AuditLogType.EventAdded,
    AuditLogType.EventEdited,
    AuditLogType.EventDeleted,
    AuditLogType.EventNotificationAdded,
    AuditLogType.EventNotificationEdited,
    AuditLogType.EventNotificationDeleted,

    AuditLogType.WebshopAdded,
    AuditLogType.WebshopEdited,
    AuditLogType.WebshopDeleted,
    AuditLogType.OrderAdded,
    AuditLogType.OrderEdited,
    AuditLogType.OrderDeleted,

    AuditLogType.PaymentAdded,
    AuditLogType.PaymentEdited,
    AuditLogType.PaymentDeleted,
    AuditLogType.BalanceItemAdded,
    AuditLogType.BalanceItemEdited,
    AuditLogType.BalanceItemDeleted,

    // Messages, then problems with e-mail addresses, then templates
    AuditLogType.EmailSending,
    AuditLogType.EmailSent,
    AuditLogType.EmailPublished,
    AuditLogType.EmailEdited,
    AuditLogType.EmailDeleted,
    AuditLogType.EmailAddressHardBounced,
    AuditLogType.EmailAddressSoftBounced,
    AuditLogType.EmailAddressMarkedAsSpam,
    AuditLogType.EmailAddressFraudComplaint,
    AuditLogType.EmailAddressUnsubscribed,
    AuditLogType.EmailTemplateAdded,
    AuditLogType.EmailTemplateEdited,
    AuditLogType.EmailTemplateDeleted,

    AuditLogType.UserAdded,
    AuditLogType.UserEdited,
    AuditLogType.UserDeleted,
    AuditLogType.UserTwoFactorMethodAdded,
    AuditLogType.UserTwoFactorMethodDeleted,
    AuditLogType.UserRecoveryCodesRegenerated,
    AuditLogType.MemberSecurityCodeRequested,
    AuditLogType.MemberSecurityCodeUsed,
    AuditLogType.MemberSecurityCodeFailed,
    AuditLogType.UserImpersonated,

    AuditLogType.DocumentTemplateAdded,
    AuditLogType.DocumentTemplateEdited,
    AuditLogType.DocumentTemplateDeleted,

    AuditLogType.OrganizationAdded,
    AuditLogType.OrganizationEdited,
    AuditLogType.OrganizationDeleted,

    AuditLogType.PlatformSettingsChanged,
    AuditLogType.RegistrationPeriodAdded,
    AuditLogType.RegistrationPeriodEdited,
    AuditLogType.RegistrationPeriodDeleted,
    AuditLogType.StripeAccountAdded,
    AuditLogType.StripeAccountEdited,
    AuditLogType.StripeAccountDeleted,

    AuditLogType.Unknown,
];

export function getAuditLogTypeCategory(type: AuditLogType, context: AuditLogTypeContext): AuditLogTypeCategory {
    switch (type) {
        case AuditLogType.MemberEdited:
        case AuditLogType.MemberAdded:
        case AuditLogType.MemberDeleted:
            return AuditLogTypeCategory.Members;

        case AuditLogType.MemberRegistered:
        case AuditLogType.MemberUnregistered:
        case AuditLogType.RegistrationInvitationAdded:
        case AuditLogType.RegistrationInvitationDeleted:
            return AuditLogTypeCategory.Registrations;

        case AuditLogType.GroupEdited:
        case AuditLogType.GroupAdded:
        case AuditLogType.GroupDeleted:
        case AuditLogType.WaitingListEdited:
        case AuditLogType.WaitingListAdded:
        case AuditLogType.WaitingListDeleted:
            return AuditLogTypeCategory.Groups;

        case AuditLogType.EventEdited:
        case AuditLogType.EventAdded:
        case AuditLogType.EventDeleted:
        case AuditLogType.EventNotificationAdded:
        case AuditLogType.EventNotificationEdited:
        case AuditLogType.EventNotificationDeleted:
            return AuditLogTypeCategory.Events;

        case AuditLogType.WebshopEdited:
        case AuditLogType.WebshopAdded:
        case AuditLogType.WebshopDeleted:
        case AuditLogType.OrderAdded:
        case AuditLogType.OrderEdited:
        case AuditLogType.OrderDeleted:
            return AuditLogTypeCategory.Webshops;

        case AuditLogType.PaymentAdded:
        case AuditLogType.PaymentEdited:
        case AuditLogType.PaymentDeleted:
        case AuditLogType.BalanceItemAdded:
        case AuditLogType.BalanceItemEdited:
        case AuditLogType.BalanceItemDeleted:
            return AuditLogTypeCategory.Payments;

        case AuditLogType.EmailSent:
        case AuditLogType.EmailSending:
        case AuditLogType.EmailPublished:
        case AuditLogType.EmailEdited:
        case AuditLogType.EmailDeleted:
        case AuditLogType.EmailAddressMarkedAsSpam:
        case AuditLogType.EmailAddressHardBounced:
        case AuditLogType.EmailAddressSoftBounced:
        case AuditLogType.EmailAddressUnsubscribed:
        case AuditLogType.EmailAddressFraudComplaint:
        case AuditLogType.EmailTemplateAdded:
        case AuditLogType.EmailTemplateEdited:
        case AuditLogType.EmailTemplateDeleted:
            return AuditLogTypeCategory.Emails;

        case AuditLogType.UserAdded:
        case AuditLogType.UserEdited:
        case AuditLogType.UserDeleted:
        case AuditLogType.UserTwoFactorMethodAdded:
        case AuditLogType.UserTwoFactorMethodDeleted:
        case AuditLogType.UserRecoveryCodesRegenerated:
        case AuditLogType.UserImpersonated:
        case AuditLogType.MemberSecurityCodeUsed:
        case AuditLogType.MemberSecurityCodeFailed:
        case AuditLogType.MemberSecurityCodeRequested:
            return AuditLogTypeCategory.Users;

        case AuditLogType.MemberResponsibilityRecordAdded:
        case AuditLogType.MemberResponsibilityRecordEdited:
        case AuditLogType.MemberResponsibilityRecordDeleted:
            return AuditLogTypeCategory.Responsibilities;

        case AuditLogType.MemberPlatformMembershipAdded:
        case AuditLogType.MemberPlatformMembershipEdited:
        case AuditLogType.MemberPlatformMembershipDeleted:
            return AuditLogTypeCategory.PlatformMemberships;

        case AuditLogType.DocumentTemplateAdded:
        case AuditLogType.DocumentTemplateEdited:
        case AuditLogType.DocumentTemplateDeleted:
            return AuditLogTypeCategory.Documents;

        case AuditLogType.OrganizationAdded:
        case AuditLogType.OrganizationDeleted:
            return AuditLogTypeCategory.Organizations;

        case AuditLogType.OrganizationEdited:
            // Within an organization, these are changes to its own settings
            return context.isOrganizationLog ? AuditLogTypeCategory.Settings : AuditLogTypeCategory.Organizations;

        case AuditLogType.PlatformSettingsChanged:
        case AuditLogType.RegistrationPeriodEdited:
        case AuditLogType.RegistrationPeriodAdded:
        case AuditLogType.RegistrationPeriodDeleted:
        case AuditLogType.StripeAccountAdded:
        case AuditLogType.StripeAccountDeleted:
        case AuditLogType.StripeAccountEdited:
            return AuditLogTypeCategory.Settings;

        case AuditLogType.Unknown:
            return AuditLogTypeCategory.Other;
    }
}

export function getAuditLogTypeCategoryName(category: AuditLogTypeCategory, context: AuditLogTypeContext): string {
    switch (category) {
        case AuditLogTypeCategory.Members:
            return $t('Leden');
        case AuditLogTypeCategory.Registrations:
            return $t('Inschrijvingen en uitnodigingen');
        case AuditLogTypeCategory.Groups:
            return $t('Groepen en wachtlijsten');
        case AuditLogTypeCategory.Events:
            return context.isPlatform ? $t('Activiteiten en kampmeldingen') : $t('Activiteiten');
        case AuditLogTypeCategory.Webshops:
            return $t('Webshops en bestellingen');
        case AuditLogTypeCategory.Payments:
            return $t('Betalingen en openstaande bedragen');
        case AuditLogTypeCategory.Emails:
            return $t('E-mails');
        case AuditLogTypeCategory.Users:
            return $t('Accounts en beveiliging');
        case AuditLogTypeCategory.Responsibilities:
            return $t('Functies');
        case AuditLogTypeCategory.PlatformMemberships:
            return $t('Aansluitingen');
        case AuditLogTypeCategory.Documents:
            return $t('Documenten');
        case AuditLogTypeCategory.Organizations:
            return $t('#Lokale-groepen');
        case AuditLogTypeCategory.Settings:
            return $t('Instellingen en werkjaren');
        case AuditLogTypeCategory.Other:
            return $t('Overige');
    }
}

/**
 * Name of a type in the filters. Within an organization, changes to the organization are changes to its own settings.
 */
export function getAuditLogTypeFilterName(type: AuditLogType, context: AuditLogTypeContext): string {
    if (type === AuditLogType.OrganizationEdited && context.isOrganizationLog) {
        return $t('Wijzigingen aan deze #lokale-groep');
    }
    return getAuditLogTypeName(type);
}
