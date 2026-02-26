import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, MapDecoder, StringDecoder, StringOrNumberDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { RenderContext, renderTemplate } from './AuditLogRenderer.js';
import { AuditLogReplacement } from './AuditLogReplacement.js';
import { NamedObject } from './Event.js';

export enum AuditLogSource {
    User = 'User',
    System = 'System',

    /**
     * Caused by a change in payment status
     */
    Payment = 'Payment',

    /**
     * E.g. orders placed via a webshop.
     */
    Anonymous = 'Anonymous',
}

export enum AuditLogType {
    /**
     * Used for legacy logs
     */
    Unknown = 'Unknown',
    MemberRegistered = 'MemberRegistered',
    MemberUnregistered = 'MemberUnregistered',
    PlatformSettingsChanged = 'PlatformSettingsChanged',

    OrganizationAdded = 'OrganizationAdded',
    OrganizationDeleted = 'OrganizationDeleted',
    OrganizationEdited = 'OrganizationEdited',

    // Events
    EventEdited = 'EventEdited',
    EventAdded = 'EventAdded',
    EventDeleted = 'EventDeleted',

    // Members
    MemberEdited = 'MemberEdited',
    MemberAdded = 'MemberAdded',
    MemberDeleted = 'MemberDeleted',

    // Groups
    GroupEdited = 'GroupEdited',
    GroupAdded = 'GroupAdded',
    GroupDeleted = 'GroupDeleted',

    // Webshops
    WebshopEdited = 'WebshopEdited',
    WebshopAdded = 'WebshopAdded',
    WebshopDeleted = 'WebshopDeleted',

    // Waiting lists
    WaitingListEdited = 'WaitingListEdited',
    WaitingListAdded = 'WaitingListAdded',
    WaitingListDeleted = 'WaitingListDeleted',

    // Periods
    RegistrationPeriodEdited = 'RegistrationPeriodEdited',
    RegistrationPeriodAdded = 'RegistrationPeriodAdded',
    RegistrationPeriodDeleted = 'RegistrationPeriodDeleted',

    // Stripe
    StripeAccountAdded = 'StripeAccountAdded',
    StripeAccountDeleted = 'StripeAccountDeleted',
    StripeAccountEdited = 'StripeAccountEdited',

    // Orders
    OrderAdded = 'OrderAdded',
    OrderEdited = 'OrderEdited',
    OrderDeleted = 'OrderDeleted',

    // Payment
    PaymentAdded = 'PaymentAdded',
    PaymentEdited = 'PaymentEdited',
    PaymentDeleted = 'PaymentDeleted',

    // Document templates
    DocumentTemplateAdded = 'DocumentTemplateAdded',
    DocumentTemplateEdited = 'DocumentTemplateEdited',
    DocumentTemplateDeleted = 'DocumentTemplateDeleted',

    // Users
    UserAdded = 'UserAdded',
    UserEdited = 'UserEdited',
    UserDeleted = 'UserDeleted',

    // MemberResponsibilityRecord
    MemberResponsibilityRecordAdded = 'MemberResponsibilityRecordAdded',
    MemberResponsibilityRecordEdited = 'MemberResponsibilityRecordEdited',
    MemberResponsibilityRecordDeleted = 'MemberResponsibilityRecordDeleted',

    // MemberPlatformMembership
    MemberPlatformMembershipAdded = 'MemberPlatformMembershipAdded',
    MemberPlatformMembershipEdited = 'MemberPlatformMembershipEdited',
    MemberPlatformMembershipDeleted = 'MemberPlatformMembershipDeleted',

    // Security code
    MemberSecurityCodeUsed = 'MemberSecurityCodeUsed',

    // Email
    EmailSent = 'EmailSent',
    EmailSending = 'EmailSending',
    EmailPublished = 'EmailPublished',
    EmailEdited = 'EmailEdited',
    EmailDeleted = 'EmailDeleted',

    // Marked as spam events
    EmailAddressMarkedAsSpam = 'EmailAddressMarkedAsSpam',
    EmailAddressHardBounced = 'EmailAddressHardBounced',
    EmailAddressSoftBounced = 'EmailAddressSoftBounced',
    EmailAddressUnsubscribed = 'EmailAddressUnsubscribed',
    EmailAddressFraudComplaint = 'EmailAddressFraudComplaint',

    EmailTemplateAdded = 'EmailTemplateAdded',
    EmailTemplateEdited = 'EmailTemplateEdited',
    EmailTemplateDeleted = 'EmailTemplateDeleted',
}

export function getAuditLogTypeName(type: AuditLogType): string {
    switch (type) {
        case AuditLogType.MemberEdited:
            return `Wijzigingen aan gegevens van leden`;
        case AuditLogType.MemberAdded:
            return `Nieuwe leden`;
        case AuditLogType.MemberDeleted:
            return `Verwijderde leden`;
        case AuditLogType.MemberRegistered:
            return `Inschrijvingen`;
        case AuditLogType.MemberUnregistered:
            return `Uitschrijvingen`;
        case AuditLogType.Unknown:
            return `Onbekende actie`;
        case AuditLogType.PlatformSettingsChanged:
            return `Wijzigingen aan platforminstellingen`;
        case AuditLogType.OrganizationEdited:
            return `Wijzigingen aan instellingen van een groep`;
        case AuditLogType.OrganizationAdded:
            return `Nieuwe lokale groepen`;
        case AuditLogType.OrganizationDeleted:
            return `Verwijderde lokale groepen`;
        case AuditLogType.EventEdited:
            return `Wijzigingen aan activiteiten`;
        case AuditLogType.EventAdded:
            return `Nieuwe activiteiten`;
        case AuditLogType.EventDeleted:
            return `Verwijderde activiteiten`;
        case AuditLogType.GroupEdited:
            return `Wijzigingen aan groepen`;
        case AuditLogType.GroupAdded:
            return `Nieuwe groepen`;
        case AuditLogType.GroupDeleted:
            return `Verwijderde groepen`;
        case AuditLogType.WaitingListEdited:
            return `Wijzigingen aan wachtlijsten`;
        case AuditLogType.WaitingListAdded:
            return `Nieuwe wachtlijsten`;
        case AuditLogType.WaitingListDeleted:
            return `Verwijderde wachtlijsten`;
        case AuditLogType.RegistrationPeriodEdited:
            return `Wijzigingen aan werkjaren`;
        case AuditLogType.RegistrationPeriodAdded:
            return `Nieuwe werkjaren`;
        case AuditLogType.RegistrationPeriodDeleted:
            return `Verwijderde werkjaren`;
        case AuditLogType.StripeAccountAdded:
            return `Stripe account aangemaakt`;
        case AuditLogType.StripeAccountDeleted:
            return `Stripe account verwijderd`;
        case AuditLogType.StripeAccountEdited:
            return `Stripe account gewijzigd`;
        case AuditLogType.WebshopEdited:
            return `Wijzigingen aan webshops`;
        case AuditLogType.WebshopAdded:
            return `Nieuwe webshops`;
        case AuditLogType.WebshopDeleted:
            return `Verwijderde webshops`;
        case AuditLogType.OrderAdded:
            return `Nieuwe bestellingen`;
        case AuditLogType.OrderEdited:
            return `Wijzigingen aan bestellingen`;
        case AuditLogType.OrderDeleted:
            return `Verwijderde bestellingen`;
        case AuditLogType.PaymentAdded:
            return `Nieuwe betalingen`;
        case AuditLogType.PaymentEdited:
            return `Wijzigingen aan betalingen`;
        case AuditLogType.PaymentDeleted:
            return `Verwijderde betalingen`;
        case AuditLogType.DocumentTemplateAdded:
            return `Nieuwe document`;
        case AuditLogType.DocumentTemplateEdited:
            return `Wijzigingen aan documenten`;
        case AuditLogType.DocumentTemplateDeleted:
            return `Verwijderde documenten`;
        case AuditLogType.UserAdded:
            return `Nieuwe accounts`;
        case AuditLogType.UserEdited:
            return `Wijzigingen aan accounts`;
        case AuditLogType.UserDeleted:
            return `Verwijderde accounts`;
        case AuditLogType.MemberResponsibilityRecordAdded:
            return `Nieuwe toegekende functies`;
        case AuditLogType.MemberResponsibilityRecordEdited:
            return `Wijzigingen aan toegekende functies`;
        case AuditLogType.MemberResponsibilityRecordDeleted:
            return `Verwijderde functies`;

        case AuditLogType.MemberPlatformMembershipAdded:
            return `Nieuwe aansluitingen`;
        case AuditLogType.MemberPlatformMembershipEdited:
            return `Wijzigingen aan aansluitingen`;
        case AuditLogType.MemberPlatformMembershipDeleted:
            return `Verwijderde aansluitingen`;

        case AuditLogType.EmailSent:
            return `Succesvol verzonden e-mails`;
        case AuditLogType.EmailSending:
            return `E-mail gestart met verzenden`;
        case AuditLogType.EmailPublished:
            return `Gepubliceerde berichten`;
        case AuditLogType.EmailEdited:
            return `Wijzigingen aan berichten`;
        case AuditLogType.EmailDeleted:
            return `Verwijderde berichten`;

        case AuditLogType.EmailAddressMarkedAsSpam:
            return `E-mailadressen gemarkeerd als spam`;
        case AuditLogType.EmailAddressHardBounced:
            return `E-mailadressen die hard gebounced zijn`;
        case AuditLogType.EmailAddressSoftBounced:
            return `E-mailadressen die soft gebounced zijn`;
        case AuditLogType.EmailAddressUnsubscribed:
            return `E-mailadressen die zich hebben uitgeschreven`;

        case AuditLogType.EmailTemplateAdded:
            return `Nieuw e-mailsjabloon`;
        case AuditLogType.EmailTemplateEdited:
            return `Wijzigingen aan e-mailsjablonen`;
        case AuditLogType.EmailTemplateDeleted:
            return `Verwijderde E-mailsjablonen`;

        case AuditLogType.EmailAddressFraudComplaint:
            return `E-mailadressen die een fraudeklacht hebben ingediend`;

        case AuditLogType.MemberSecurityCodeUsed:
            return `Gebruik van beveiligingscodes`;
    }
}

export function getAuditLogTypeIcon(type: AuditLogType): [icon: string, subIcon?: string] {
    switch (type) {
        case AuditLogType.MemberEdited:
            return [`user`, `edit stroke`];
        case AuditLogType.MemberAdded:
            return [`user`, 'add green'];
        case AuditLogType.MemberDeleted:
            return [`user`, `trash red stroke`];
        case AuditLogType.MemberRegistered:
            return [`membership-filled`, `success`];
        case AuditLogType.MemberUnregistered:
            return [`membership-filled`, `canceled red`];
        case AuditLogType.PlatformSettingsChanged:
            return [`flag`, `settings stroke`];

        case AuditLogType.OrganizationEdited:
            return [`flag`];
        case AuditLogType.OrganizationAdded:
            return [`flag`, `add green`];
        case AuditLogType.OrganizationDeleted:
            return [`flag`, `trash red stroke`];

        case AuditLogType.Unknown:
            return [`history`];

        case AuditLogType.EventEdited:
            return [`calendar`, `edit stroke`];
        case AuditLogType.EventAdded:
            return [`calendar`, `add green`];
        case AuditLogType.EventDeleted:
            return [`calendar`, `trash red stroke`];

        case AuditLogType.GroupEdited:
            return [`group`, `edit stroke`];
        case AuditLogType.GroupAdded:
            return [`group`, `add green`];
        case AuditLogType.GroupDeleted:
            return [`group`, `trash red stroke`];

        case AuditLogType.WaitingListEdited:
            return [`hourglass`, `edit stroke`];
        case AuditLogType.WaitingListAdded:
            return [`hourglass`, `add green`];
        case AuditLogType.WaitingListDeleted:
            return [`hourglass`, `trash red stroke`];

        case AuditLogType.RegistrationPeriodEdited:
            return [`history`, `edit stroke`];
        case AuditLogType.RegistrationPeriodAdded:
            return [`history`, `add green`];
        case AuditLogType.RegistrationPeriodDeleted:
            return [`history`, `trash red stroke`];

        case AuditLogType.StripeAccountAdded:
            return [`stripe`, `add green`];
        case AuditLogType.StripeAccountDeleted:
            return [`stripe`, `trash red stroke`];
        case AuditLogType.StripeAccountEdited:
            return [`stripe`, `edit stroke`];

        case AuditLogType.WebshopEdited:
            return [`basket`, `edit stroke`];
        case AuditLogType.WebshopAdded:
            return [`basket`, `add green`];
        case AuditLogType.WebshopDeleted:
            return [`basket`, `trash red stroke`];
        case AuditLogType.OrderAdded:
            return [`basket`, `add green`];
        case AuditLogType.OrderEdited:
            return [`basket`, `edit stroke`];
        case AuditLogType.OrderDeleted:
            return [`basket`, `trash red stroke`];

        case AuditLogType.PaymentAdded:
            return [`card`, `add green`];
        case AuditLogType.PaymentEdited:
            return [`card`, `edit stroke`];
        case AuditLogType.PaymentDeleted:
            return [`card`, `trash red stroke`];

        case AuditLogType.DocumentTemplateAdded:
            return [`file`, `add green`];
        case AuditLogType.DocumentTemplateEdited:
            return [`file`, `edit stroke`];
        case AuditLogType.DocumentTemplateDeleted:
            return [`file`, `trash red stroke`];

        case AuditLogType.UserAdded:
            return [`user`, `add green`];
        case AuditLogType.UserEdited:
            return [`user`, `edit stroke`];
        case AuditLogType.UserDeleted:
            return [`user`, `trash red stroke`];

        case AuditLogType.MemberResponsibilityRecordAdded:
            return [`star`, `add green`];
        case AuditLogType.MemberResponsibilityRecordEdited:
            return [`star`, `edit stroke`];
        case AuditLogType.MemberResponsibilityRecordDeleted:
            return [`star`, `trash red stroke`];

        case AuditLogType.MemberPlatformMembershipAdded:
            return [`membership-filled`, `add green`];
        case AuditLogType.MemberPlatformMembershipEdited:
            return [`membership-filled`, `edit stroke`];
        case AuditLogType.MemberPlatformMembershipDeleted:
            return [`membership-filled`, `trash red stroke`];

        case AuditLogType.EmailSent:
            return [`email`, `send primary stroke`];
        case AuditLogType.EmailSending:
            return [`email`, `clock stroke`];
        case AuditLogType.EmailPublished:
            return [`email`, `earth primary`];
        case AuditLogType.EmailEdited:
            return [`email`, `edit stroke`];
        case AuditLogType.EmailDeleted:
            return [`email`, `trash red stroke`];

        case AuditLogType.EmailAddressMarkedAsSpam:
            return [`email`, `error red stroke`];
        case AuditLogType.EmailAddressHardBounced:
            return [`email`, `error red stroke`];
        case AuditLogType.EmailAddressSoftBounced:
            return [`email`, `warning stroke`];
        case AuditLogType.EmailAddressUnsubscribed:
            return [`email`, `disabled red stroke`];
        case AuditLogType.EmailAddressFraudComplaint:
            return [`email`, `error red stroke`];

        case AuditLogType.EmailTemplateAdded:
            return [`email-template`, `add green`];
        case AuditLogType.EmailTemplateEdited:
            return [`email-template`, `edit stroke`];
        case AuditLogType.EmailTemplateDeleted:
            return [`email-template`, `trash red stroke`];

        case AuditLogType.MemberSecurityCodeUsed:
            return [`key`, `success primary stroke`];
    }
}

function getAuditLogTypeTitleTemplate(type: AuditLogType): string {
    switch (type) {
        case AuditLogType.MemberAdded:
            return `{{m}} werd aangemaakt`;
        case AuditLogType.MemberDeleted:
            return `{{m}} werd verwijderd`;
        case AuditLogType.MemberEdited:
            return `De gegevens van {{m}} werden gewijzigd`;
        case AuditLogType.MemberRegistered:
            return `{{m}} werd ingeschreven voor {{g}}{{if org " (" org ")"}}`;
        case AuditLogType.MemberUnregistered:
            return `{{m}} werd uitgeschreven voor {{g}}{{if org " (" org ")"}}`;
        case AuditLogType.Unknown:
            return `Onbekende actie`;
        case AuditLogType.PlatformSettingsChanged:
            return `De platforminstellingen werden gewijzigd`;

        case AuditLogType.OrganizationEdited:
            return `{{if org 'De instellingen van ' org ' werden gewijzigd'}}{{unless org 'De instellingen werden gewijzigd'}}`;

        case AuditLogType.OrganizationAdded:
            return $t(`De vereniging {{org}} werd aangemaakt`);

        case AuditLogType.OrganizationDeleted:
            return $t(`De vereniging {{org}} werd verwijderd`);

        case AuditLogType.EventEdited:
            return `De activiteit {{e}}{{if org " (" org ")"}} werd gewijzigd`;

        case AuditLogType.EventAdded:
            return `De activiteit {{e}}{{if org " (" org ")"}} werd aangemaakt`;

        case AuditLogType.EventDeleted:
            return `De activiteit {{e}}{{if org " (" org ")"}} werd verwijderd`;

        case AuditLogType.GroupEdited:
            return `De groep {{g}}{{if org " (" org ")"}} werd gewijzigd`;

        case AuditLogType.GroupAdded:
            return `De groep {{g}}{{if org " (" org ")"}} werd aangemaakt`;

        case AuditLogType.GroupDeleted:
            return `De groep {{g}}{{if org " (" org ")"}} werd verwijderd`;

        case AuditLogType.WaitingListEdited:
            return `De wachtlijst {{g}}{{if org " (" org ")"}} werd gewijzigd`;

        case AuditLogType.WaitingListAdded:
            return `De wachtlijst {{g}}{{if org " (" org ")"}} werd aangemaakt`;

        case AuditLogType.WaitingListDeleted:
            return `De wachtlijst {{g}}{{if org " (" org ")"}} werd verwijderd`;

        case AuditLogType.RegistrationPeriodEdited:
            return `Het werkjaar {{p}} werd gewijzigd`;

        case AuditLogType.RegistrationPeriodAdded:
            return `Het werkjaar {{p}} werd aangemaakt`;

        case AuditLogType.RegistrationPeriodDeleted:
            return `Het werkjaar {{p}} werd verwijderd`;

        case AuditLogType.StripeAccountAdded:
            return `Stripe account {{a}}{{if org " (" org ")"}} aangemaakt`;
        case AuditLogType.StripeAccountDeleted:
            return `Stripe account {{a}}{{if org " (" org ")"}} verwijderd`;
        case AuditLogType.StripeAccountEdited:
            return `Stripe account {{a}}{{if org " (" org ")"}} gewijzigd`;

        case AuditLogType.WebshopEdited:
            return `De webshop {{w}}{{if org " (" org ")"}} werd gewijzigd`;
        case AuditLogType.WebshopAdded:
            return `De webshop {{w}}{{if org " (" org ")"}} werd aangemaakt`;
        case AuditLogType.WebshopDeleted:
            return `De webshop {{w}}{{if org " (" org ")"}} werd verwijderd`;

        case AuditLogType.OrderAdded:
            return `{{capitalizeFirstLetter o}} werd geplaatst (voor {{w}})`;
        case AuditLogType.OrderEdited:
            return `{{capitalizeFirstLetter o}} werd gewijzigd ({{w}})`;
        case AuditLogType.OrderDeleted:
            return `{{capitalizeFirstLetter o}} werd verwijderd ({{w}})`;

        case AuditLogType.PaymentAdded:
            return `{{capitalizeFirstLetter p}} werd aangemaakt`;
        case AuditLogType.PaymentEdited:
            return `{{capitalizeFirstLetter p}} werd gewijzigd`;
        case AuditLogType.PaymentDeleted:
            return `{{capitalizeFirstLetter p}} werd verwijderd`;

        case AuditLogType.DocumentTemplateAdded:
            return `Document {{d}}{{if org " (" org ")"}} werd aangemaakt`;
        case AuditLogType.DocumentTemplateEdited:
            return `Document {{d}}{{if org " (" org ")"}} werd gewijzigd`;
        case AuditLogType.DocumentTemplateDeleted:
            return `Document {{d}}{{if org " (" org ")"}} werd verwijderd`;

        case AuditLogType.UserAdded:
            return `Account {{u}} werd aangemaakt`;
        case AuditLogType.UserEdited:
            return `Account {{u}} werd gewijzigd`;
        case AuditLogType.UserDeleted:
            return `Account {{u}} werd verwijderd`;

        case AuditLogType.MemberResponsibilityRecordAdded:
            return `Functie {{r}}{{if g " van " g}}{{if org " (" org ")"}} werd toegekend aan {{m}}`;
        case AuditLogType.MemberResponsibilityRecordEdited:
            return `Functie {{r}}{{if g " van " g}}{{if org " (" org ")"}} werd gewijzigd bij {{m}}`;
        case AuditLogType.MemberResponsibilityRecordDeleted:
            return `Functie {{r}}{{if g " van " g}}{{if org " (" org ")"}} werd verwijderd van {{m}}`;

        case AuditLogType.MemberPlatformMembershipAdded:
            return `Aansluiting {{pm}} werd toegevoegd bij {{m}}{{if org " via " org}}`;
        case AuditLogType.MemberPlatformMembershipEdited:
            return `Aansluiting {{pm}} werd gewijzigd bij {{m}}{{if org " via " org}}`;
        case AuditLogType.MemberPlatformMembershipDeleted:
            return `Aansluiting {{pm}} werd verwijderd bij {{m}}{{if org " via " org}}`;

        case AuditLogType.EmailSent:
            return `E-mail {{e}} werd succesvol verzonden aan {{c}} {{ plural c 'ontvanger' 'ontvangers' }}`;

        case AuditLogType.EmailPublished:
            return `Bericht {{e}} werd succesvol gepubliceerd`;

        case AuditLogType.EmailEdited:
            return `Bericht {{e}} werd gewijzigd`;

        case AuditLogType.EmailDeleted:
            return `Bericht {{e}} werd verwijderd`;

        case AuditLogType.EmailSending:
            return `E-mail {{e}} werd ingepland om te verzenden aan {{c}} {{ plural c 'ontvanger' 'ontvangers' }}`;

        case AuditLogType.EmailAddressMarkedAsSpam:
            return `{{if subject 'De e-mail ‘', subject '’'}}{{unless subject 'Een e-mail'}} werd door {{e}} als spam gemarkeerd`;

        case AuditLogType.EmailAddressFraudComplaint:
            return `{{if subject 'De e-mail ‘', subject '’'}}{{unless subject 'Een e-mail'}} werd door {{e}} als fraude, phishing of virus gemarkeerd`;

        case AuditLogType.EmailAddressHardBounced:
            return `{{if subject 'De e-mail ‘', subject '’'}}{{unless subject 'Een e-mail'}} naar {{e}} is permanent mislukt`;

        case AuditLogType.EmailAddressSoftBounced:
            return `{{if subject 'De e-mail ‘', subject '’'}}{{unless subject 'Een e-mail'}} naar {{e}} is mislukt`;

        case AuditLogType.EmailAddressUnsubscribed:
            return `{{e}} heeft zich uitgeschreven voor e-mails`;

        case AuditLogType.EmailTemplateAdded:
            return `E-mailsjabloon {{e}} werd aangemaakt {{if org " voor " org}}`;

        case AuditLogType.EmailTemplateEdited:
            return `E-mailsjabloon {{e}} werd gewijzigd {{if org " voor " org}}`;

        case AuditLogType.EmailTemplateDeleted:
            return `E-mailsjabloon {{e}} werd verwijderd {{if org " voor " org}}`;

        case AuditLogType.MemberSecurityCodeUsed:
            return `De beveiligingscode werd gebruikt om toegang te krijgen tot {{m}}`;
    }
}

function getAuditLogTypeDescriptionTemplate(type: AuditLogType): string | undefined {
    switch (type) {
        case AuditLogType.EmailSent:
            return `{{html}}`;

        case AuditLogType.EmailAddressMarkedAsSpam:
            return `Verzonden door {{sender}} {{if org " (" org ")"}}\n{{if subType 'Reden: ' subType '\n'}}{{if response 'Volledig antwoord: ' response '\n'}}Soms doen mensen dit per ongeluk. Vraag hen dan de e-mail terug als 'geen spam' te markeren.`;

        case AuditLogType.EmailAddressHardBounced:
            return `Verzonden door {{sender}} {{if org " (" org ")"}}\n{{if subType 'Reden: ' subType '\n'}}{{if response 'Volledig antwoord: ' response '\n'}}De e-mailprovider gaat ervanuit dat dit een permanent probleem is, dus toekomstige e-mails zullen niet meer verzonden worden naar dit adres. Meestal komt dit voor bij een ongeldig e-mailadres.`;

        case AuditLogType.EmailAddressSoftBounced:
            return `Verzonden door {{sender}} {{if org " (" org ")"}}\n{{if subType 'Reden: ' subType '\n'}}{{if response 'Volledig antwoord: ' response '\n'}}Wellicht gaat het om een tijdelijk probleem (bv. volle inbox).`;

        case AuditLogType.EmailAddressFraudComplaint:
            return `Verzonden door {{sender}} {{if org " (" org ")"}}\n{{if subType 'Reden: ' subType '\n'}}{{if response 'Volledig antwoord: ' response}}`;
    }
}

export function getAuditLogTypeReplacements(type: AuditLogType): string[] {
    switch (type) {
        case AuditLogType.MemberAdded:
        case AuditLogType.MemberEdited:
        case AuditLogType.MemberDeleted:
        case AuditLogType.MemberSecurityCodeUsed:
            return ['m'];
        case AuditLogType.MemberRegistered:
        case AuditLogType.MemberUnregistered:
            return ['m', 'g'];
        case AuditLogType.OrganizationEdited:
        case AuditLogType.OrganizationAdded:
        case AuditLogType.OrganizationDeleted:
            return ['org'];
        case AuditLogType.Unknown:
            return [];
        case AuditLogType.EventAdded:
        case AuditLogType.EventEdited:
        case AuditLogType.EventDeleted:
            return ['e'];
        case AuditLogType.GroupEdited:
        case AuditLogType.GroupAdded:
        case AuditLogType.GroupDeleted:
        case AuditLogType.WaitingListEdited:
        case AuditLogType.WaitingListAdded:
        case AuditLogType.WaitingListDeleted:
            return ['g'];

        case AuditLogType.RegistrationPeriodEdited:
        case AuditLogType.RegistrationPeriodAdded:
        case AuditLogType.RegistrationPeriodDeleted:
            return ['p'];

        case AuditLogType.StripeAccountAdded:
        case AuditLogType.StripeAccountDeleted:
        case AuditLogType.StripeAccountEdited:
            return ['a'];

        case AuditLogType.WebshopEdited:
        case AuditLogType.WebshopAdded:
        case AuditLogType.WebshopDeleted:
            return ['w'];

        case AuditLogType.OrderAdded:
        case AuditLogType.OrderEdited:
        case AuditLogType.OrderDeleted:
            return ['o', 'w'];

        case AuditLogType.PaymentAdded:
        case AuditLogType.PaymentEdited:
        case AuditLogType.PaymentDeleted:
            return ['p'];

        case AuditLogType.DocumentTemplateAdded:
        case AuditLogType.DocumentTemplateEdited:
        case AuditLogType.DocumentTemplateDeleted:
            return ['d'];

        case AuditLogType.UserAdded:
        case AuditLogType.UserEdited:
        case AuditLogType.UserDeleted:
            return ['u'];

        case AuditLogType.MemberResponsibilityRecordAdded:
        case AuditLogType.MemberResponsibilityRecordEdited:
        case AuditLogType.MemberResponsibilityRecordDeleted:
            return ['r', 'm'];

        case AuditLogType.MemberPlatformMembershipAdded:
        case AuditLogType.MemberPlatformMembershipEdited:
        case AuditLogType.MemberPlatformMembershipDeleted:
            return ['pm', 'm'];

        case AuditLogType.EmailSent:
        case AuditLogType.EmailSending:
        case AuditLogType.EmailPublished:
        case AuditLogType.EmailEdited:
        case AuditLogType.EmailDeleted:
            return ['e'];

        case AuditLogType.EmailAddressMarkedAsSpam:
        case AuditLogType.EmailAddressHardBounced:
        case AuditLogType.EmailAddressSoftBounced:
        case AuditLogType.EmailAddressUnsubscribed:
        case AuditLogType.EmailAddressFraudComplaint:
            return ['e'];

        case AuditLogType.EmailTemplateAdded:
        case AuditLogType.EmailTemplateEdited:
        case AuditLogType.EmailTemplateDeleted:
            return ['e'];

        default:
            return [];
    }
}

export enum AuditLogPatchItemType {
    Added = 'Added',
    Removed = 'Removed',
    Changed = 'Changed',
    Reordered = 'Reordered',
}

export class AuditLogPatchItem extends AutoEncoder {
    @field({ field: 'k', decoder: AuditLogReplacement })
    key: AuditLogReplacement = AuditLogReplacement.empty();

    @field({ field: 'o', decoder: AuditLogReplacement, optional: true })
    oldValue?: AuditLogReplacement;

    @field({ field: 'v', decoder: AuditLogReplacement, optional: true })
    value?: AuditLogReplacement;

    @field({ field: 't', decoder: new EnumDecoder(AuditLogPatchItemType), optional: true })
    type?: AuditLogPatchItemType;

    autoType() {
        if (!this.oldValue && this.value) {
            this.type = AuditLogPatchItemType.Added;
        }
        else if (!this.value && this.oldValue) {
            this.type = AuditLogPatchItemType.Removed;
        }
        else {
            this.type = AuditLogPatchItemType.Changed;
        }
        return this;
    }
}

const helpers = {
    plural: (context: RenderContext, object: any, singular: string, plural: string) => {
        if (object instanceof AuditLogReplacement) {
            if (object.count === undefined) {
                return object.value === '1' ? [singular] : [plural];
            }
            return object.count === 1 ? [singular] : [plural];
        }
        return [object === 1 || object === '1' ? singular : plural];
    },
    capitalizeFirstLetter: (context: RenderContext, object: any) => {
        if (object instanceof AuditLogReplacement) {
            const clone = object.clone();
            clone.value = Formatter.capitalizeFirstLetter(clone.value);
            return [clone];
        }
        return [object];
    },
    if: (context: RenderContext, object: any, ...prefixes) => {
        if (object) {
            return [...prefixes];
        }
        return [];
    },
    unless: (context: RenderContext, object: any, ...prefixes) => {
        if (!object) {
            return [...prefixes];
        }
        return [];
    },
};

export class AuditLog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: new EnumDecoder(AuditLogSource), version: 350 })
    source: AuditLogSource;

    @field({ decoder: new EnumDecoder(AuditLogType) })
    type: AuditLogType;

    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null = null;

    /**
     * The user who performed the action. Might get anonymized in case the user does not have permission to view who performed the action.
     */
    @field({ decoder: NamedObject, nullable: true })
    user: NamedObject | null;

    /**
     * The user who performed the action. Might get anonymized in case the user does not have permission to view who performed the action.
     */
    @field({ decoder: StringDecoder, nullable: true })
    objectId: string | null = null;

    /**
     * A custom description in case the patchList can't be used (try to avoid because these won't be translated)
     */
    @field({ decoder: StringDecoder })
    description: string = '';

    @field({ decoder: new MapDecoder(StringDecoder, AuditLogReplacement) })
    replacements: Map<string, AuditLogReplacement>;

    @field({ decoder: new MapDecoder(StringDecoder, StringOrNumberDecoder), version: 357 })
    meta: Map<string, string | number> = new Map();

    @field({ decoder: new ArrayDecoder(AuditLogPatchItem) })
    patchList: AuditLogPatchItem[] = [];

    @field({ decoder: DateDecoder })
    createdAt: Date;

    get renderableTitle() {
        try {
            return renderTemplate(getAuditLogTypeTitleTemplate(this.type), {
                type: 'text',
                context: Object.fromEntries(this.replacements.entries()),
                helpers,
            });
        }
        catch (e) {
            console.error('Invalid render template', e);
            return ['Onbekende actie'];
        }
    }

    get renderableDescription() {
        const template = getAuditLogTypeDescriptionTemplate(this.type);

        if (!template) {
            return [];
        }
        try {
            return renderTemplate(template, {
                type: 'text',
                context: Object.fromEntries(this.replacements.entries()),
                helpers,
            });
        }
        catch (e) {
            console.error('Invalid render template', e);
            return ['Onbekende actie'];
        }
    }

    get title() {
        return this.renderableTitle.map(v => v.toString()).join('');
    }

    get icon() {
        return getAuditLogTypeIcon(this.type)[0];
    }

    get subIcon() {
        return getAuditLogTypeIcon(this.type)[1];
    }
}
