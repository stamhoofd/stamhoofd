import { AnyDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { EmailRecipientFilterType } from './Email.js';
import { Replacement } from '../endpoints/EmailRequest.js';
import { ExampleReplacements } from './exampleReplacements.js';

export enum EmailTemplateType {
    /**
     * Template created by the user to send manually
     */
    SavedMembersEmail = 'SavedMembersEmail',

    /**
     * Defaults
     */
    DefaultMembersEmail = 'DefaultMembersEmail',
    DefaultReceivableBalancesEmail = 'DefaultReceivableBalancesEmail',
    SavedReceivableBalancesEmail = 'SavedReceivableBalancesEmail',

    //
    MembersExpirationReminder = 'MembersExpirationReminder',
    WebshopsExpirationReminder = 'WebshopsExpirationReminder',
    SingleWebshopExpirationReminder = 'SingleWebshopExpirationReminder',
    TrialWebshopsExpirationReminder = 'TrialWebshopsExpirationReminder',
    TrialMembersExpirationReminder = 'TrialMembersExpirationReminder',

    OrderNotification = 'OrderNotification',

    RegistrationConfirmation = 'RegistrationConfirmation',
    RegistrationTransferDetails = 'RegistrationTransferDetails',

    OrderConfirmationOnline = 'OrderConfirmationOnline',
    OrderConfirmationTransfer = 'OrderConfirmationTransfer',
    OrderConfirmationPOS = 'OrderConfirmationPOS',
    OrderReceivedTransfer = 'OrderReceivedTransfer',
    OrderOnlinePaymentFailed = 'OrderOnlinePaymentFailed',

    /**
     * Tickets sent immediately after ordering
     */
    TicketsConfirmation = 'TicketsConfirmation',

    /**
     * Order received, tickets will follow when we receive your payment
     */
    TicketsConfirmationTransfer = 'TicketsConfirmationTransfer',

    /**
     * Order received, tickets sent, but need to get paid at entrance
     */
    TicketsConfirmationPOS = 'TicketsConfirmationPOS',

    /**
     * Tickets sent after payment is received
     */
    TicketsReceivedTransfer = 'TicketsReceivedTransfer',

    /**
     * Organization emails:
     */
    OrganizationUnstableDNS = 'OrganizationUnstableDNS',
    OrganizationInvalidDNS = 'OrganizationInvalidDNS',
    OrganizationValidDNS = 'OrganizationValidDNS',
    OrganizationStableDNS = 'OrganizationStableDNS',
    OrganizationDNSSetupComplete = 'OrganizationDNSSetupComplete',

    // Drip emails
    OrganizationDripWelcome = 'OrganizationDripWelcome',
    OrganizationDripWebshopTrialCheckin = 'OrganizationDripWebshopTrialCheckin',
    OrganizationDripMembersTrialCheckin = 'OrganizationDripMembersTrialCheckin',
    OrganizationDripWebshopTrialExpired = 'OrganizationDripWebshopTrialExpired',
    OrganizationDripMembersTrialExpired = 'OrganizationDripMembersTrialExpired',
    OrganizationDripTrialExpiredReminder = 'OrganizationDripTrialExpiredReminder',
    OrganizationDripWebshopNotRenewed = 'OrganizationDripWebshopNotRenewed',
    OrganizationDripMembersNotRenewed = 'OrganizationDripMembersNotRenewed',

    /**
     * Exports
     */
    ExcelExportSucceeded = 'ExcelExportSucceeded',
    ExcelExportFailed = 'ExcelExportFailed',

    /**
     * User emails
     */
    ForgotPasswordButNoAccount = 'ForgotPasswordButNoAccount',
    ForgotPassword = 'ForgotPassword',

    SignupAlreadyHasAccount = 'SignupAlreadyHasAccount',

    VerifyEmail = 'VerifyEmail',
    VerifyEmailWithoutCode = 'VerifyEmailWithoutCode',
    AdminInvitation = 'AdminInvitation',
    AdminInvitationNewUser = 'AdminInvitationNewUser',

    DeleteAccountConfirmation = 'DeleteAccountConfirmation',

    /**
     * Balances
     */

    /**
     * E-mail sent to the user when their balance went up.
     * E.g. end of trial, manually added a balance item...
     */
    UserBalanceIncreaseNotification = 'UserBalanceIncreaseNotification',
    OrganizationBalanceIncreaseNotification = 'OrganizationBalanceIncreaseNotification',

    /**
     * A reminder e-mail to the user that their balance has to be paid.
     */
    UserBalanceReminder = 'UserBalanceReminder',
    OrganizationBalanceReminder = 'OrganizationBalanceReminder',

    /**
     * Event notifications
     */
    EventNotificationSubmittedCopy = 'EventNotificationSubmittedCopy',
    EventNotificationSubmittedReviewer = 'EventNotificationSubmittedReviewer',
    EventNotificationAccepted = 'EventNotificationAccepted',
    EventNotificationRejected = 'EventNotificationRejected',
}

export class EmailTemplate extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null = null;

    @field({ decoder: StringDecoder })
    subject = '';

    @field({ decoder: new EnumDecoder(EmailTemplateType) })
    type: EmailTemplateType = EmailTemplateType.SavedMembersEmail;

    @field({ decoder: StringDecoder })
    html = '';

    @field({ decoder: StringDecoder })
    text = '';

    @field({ decoder: AnyDecoder })
    json = {};

    @field({ decoder: StringDecoder, nullable: true })
    groupId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    webshopId: string | null = null;

    @field({ decoder: DateDecoder, optional: true })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder, optional: true })
    updatedAt: Date = new Date();

    static getDefaultForRecipient(type: EmailRecipientFilterType): EmailTemplateType | null {
        if (type === EmailRecipientFilterType.Members || type === EmailRecipientFilterType.MemberParents) {
            return EmailTemplateType.DefaultMembersEmail;
        }

        if (type === EmailRecipientFilterType.ReceivableBalances) {
            return EmailTemplateType.DefaultReceivableBalancesEmail;
        }

        return null;
    }

    static getSavedForRecipient(type: EmailRecipientFilterType): EmailTemplateType | null {
        if (type === EmailRecipientFilterType.Members || type === EmailRecipientFilterType.MemberParents) {
            return EmailTemplateType.SavedMembersEmail;
        }

        if (type === EmailRecipientFilterType.ReceivableBalances) {
            return EmailTemplateType.SavedReceivableBalancesEmail;
        }

        return null;
    }

    static isSavedEmail(type: EmailTemplateType): boolean {
        if (type === EmailTemplateType.SavedMembersEmail) {
            return true;
        }

        if (type === EmailTemplateType.SavedReceivableBalancesEmail) {
            return true;
        }

        return false;
    }

    static getRecipientType(type: EmailTemplateType): EmailRecipientFilterType | null {
        if (type === EmailTemplateType.SavedMembersEmail) {
            return EmailRecipientFilterType.Members;
        }

        if (type === EmailTemplateType.DefaultMembersEmail) {
            return EmailRecipientFilterType.Members;
        }

        // Use custom getSupportedReplacementsForType for this type
        return null;
    }

    static getTypeTitle(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.SavedMembersEmail: return 'Opgeslagen e-mail naar leden';
            case EmailTemplateType.SavedReceivableBalancesEmail: return 'Opgeslagen e-mail naar openstaande bedragen';

            case EmailTemplateType.DefaultMembersEmail: return 'Standaard e-mail naar leden';
            case EmailTemplateType.DefaultReceivableBalancesEmail: return 'Standaard e-mail naar openstaande bedragen';

            case EmailTemplateType.MembersExpirationReminder: return 'Herinnering verlopen pakket ledenadministratie';
            case EmailTemplateType.WebshopsExpirationReminder: return 'Herinnering verlopen pakket webshops';
            case EmailTemplateType.SingleWebshopExpirationReminder: return 'Herinnering verlopen pakket enkele webshop';
            case EmailTemplateType.TrialWebshopsExpirationReminder: return 'Herinnering verlopen proefperiode pakket webshops';
            case EmailTemplateType.TrialMembersExpirationReminder: return 'Herinnering verlopen proefperiode pakket ledenadministratie';
            case EmailTemplateType.OrderNotification: return 'Bestelling notificatie voor beheerders';

            case EmailTemplateType.RegistrationConfirmation: return 'Bevestiging van inschrijving';
            case EmailTemplateType.RegistrationTransferDetails: return 'Betaalinstructies met overschrijving';

            case EmailTemplateType.OrderConfirmationOnline: return 'Bestelling bevestiging: online betaling';
            case EmailTemplateType.OrderConfirmationTransfer: return 'Bestelling bevestiging: overschrijving';
            case EmailTemplateType.OrderConfirmationPOS: return 'Bestelling bevestiging: betaling aan de kassa';
            case EmailTemplateType.OrderReceivedTransfer: return 'Bevestiging ontvangen overschrijving';
            case EmailTemplateType.OrderOnlinePaymentFailed: return 'Online betaling mislukt';
            case EmailTemplateType.TicketsConfirmation: return 'E-mail met tickets: online betaling';
            case EmailTemplateType.TicketsConfirmationTransfer: return 'Bevestiging voor bestelling met overschrijving (nog geen tickets)';
            case EmailTemplateType.TicketsConfirmationPOS: return 'E-mail met tickets: betaling aan de kassa';
            case EmailTemplateType.TicketsReceivedTransfer: return 'E-mail met tickets: na ontvangen overschrijving';

            case EmailTemplateType.OrganizationUnstableDNS: return 'Instabiele DNS';
            case EmailTemplateType.OrganizationInvalidDNS: return 'Ongeldige DNS';
            case EmailTemplateType.OrganizationValidDNS: return 'Geldige DNS';
            case EmailTemplateType.OrganizationStableDNS: return 'Stabiele DNS';
            case EmailTemplateType.OrganizationDNSSetupComplete: return 'DNS setup compleet';

            case EmailTemplateType.OrganizationDripWelcome: return 'Welkom';
            case EmailTemplateType.OrganizationDripWebshopTrialCheckin: return 'Webshop proefperiode checkin';
            case EmailTemplateType.OrganizationDripMembersTrialCheckin: return 'Ledenadministratie proefperiode checkin';
            case EmailTemplateType.OrganizationDripWebshopTrialExpired: return 'Webshop proefperiode verlopen';
            case EmailTemplateType.OrganizationDripMembersTrialExpired: return 'Ledenadministratie proefperiode verlopen';
            case EmailTemplateType.OrganizationDripTrialExpiredReminder: return 'Proefperiode verlopen reminder';
            case EmailTemplateType.OrganizationDripWebshopNotRenewed: return 'Webshop niet verlengd';
            case EmailTemplateType.OrganizationDripMembersNotRenewed: return 'Ledenadministratie niet verlengd';

            case EmailTemplateType.ExcelExportSucceeded: return 'Excel export geslaagd';
            case EmailTemplateType.ExcelExportFailed: return 'Excel export mislukt';

            case EmailTemplateType.SignupAlreadyHasAccount: return 'Registratie: account bestaat al';
            case EmailTemplateType.ForgotPasswordButNoAccount: return 'Wachtwoord vergeten: geen account';
            case EmailTemplateType.ForgotPassword: return 'Wachtwoord vergeten';
            case EmailTemplateType.DeleteAccountConfirmation: return 'Bevestiging account verwijderen';
            case EmailTemplateType.VerifyEmail: return 'Verifieer e-mailadres';
            case EmailTemplateType.VerifyEmailWithoutCode: return 'Verifieer e-mailadres zonder code';
            case EmailTemplateType.AdminInvitation: return 'Uitnodiging beheerder: bestaande gebruiker';
            case EmailTemplateType.AdminInvitationNewUser: return 'Uitnodiging beheerder: nieuwe gebruiker';

            case EmailTemplateType.UserBalanceIncreaseNotification: return 'Saldo verhoogd';
            case EmailTemplateType.UserBalanceReminder: return 'Saldo herinnering';

            case EmailTemplateType.OrganizationBalanceIncreaseNotification: return 'Saldo verhoogd';
            case EmailTemplateType.OrganizationBalanceReminder: return 'Saldo herinnering';

            case EmailTemplateType.EventNotificationSubmittedCopy: return $t('9a9a7777-44ca-494b-9d15-c0192bc41a7f');
            case EmailTemplateType.EventNotificationSubmittedReviewer: return $t('ff2beaea-cb8f-4de8-ba1c-039b7ba20bc0');
            case EmailTemplateType.EventNotificationAccepted: return $t('c936748e-b6f9-4aa9-9822-77bd727501eb');
            case EmailTemplateType.EventNotificationRejected: return $t('01266433-c6b9-4c4b-b09f-b212cc0ce5a8');
        }
    }

    static getTypeCategory(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.SavedMembersEmail:
            case EmailTemplateType.SavedReceivableBalancesEmail:
                return 'Opgeslagen e-mail';

            case EmailTemplateType.DefaultMembersEmail:
            case EmailTemplateType.DefaultReceivableBalancesEmail:
                return 'Placeholder';

            case EmailTemplateType.MembersExpirationReminder:
            case EmailTemplateType.WebshopsExpirationReminder:
            case EmailTemplateType.SingleWebshopExpirationReminder:
            case EmailTemplateType.TrialWebshopsExpirationReminder:
            case EmailTemplateType.TrialMembersExpirationReminder:
                return 'Billing';

            case EmailTemplateType.RegistrationConfirmation:
            case EmailTemplateType.RegistrationTransferDetails:
                return 'Inschrijvingen';

            case EmailTemplateType.OrderNotification:
                return 'Webshop';
            case EmailTemplateType.OrderConfirmationOnline:
            case EmailTemplateType.OrderConfirmationTransfer:
            case EmailTemplateType.OrderConfirmationPOS:
            case EmailTemplateType.OrderReceivedTransfer:
            case EmailTemplateType.OrderOnlinePaymentFailed:
                return 'Webshop zonder tickets';
            case EmailTemplateType.TicketsConfirmation:
            case EmailTemplateType.TicketsConfirmationTransfer:
            case EmailTemplateType.TicketsConfirmationPOS:
            case EmailTemplateType.TicketsReceivedTransfer:
                return 'Webshop met tickets';

            case EmailTemplateType.OrganizationUnstableDNS:
            case EmailTemplateType.OrganizationInvalidDNS:
            case EmailTemplateType.OrganizationValidDNS:
            case EmailTemplateType.OrganizationStableDNS:
            case EmailTemplateType.OrganizationDNSSetupComplete:
                return 'DNS';

            case EmailTemplateType.OrganizationDripWelcome:
            case EmailTemplateType.OrganizationDripWebshopTrialCheckin:
            case EmailTemplateType.OrganizationDripMembersTrialCheckin:
            case EmailTemplateType.OrganizationDripWebshopTrialExpired:
            case EmailTemplateType.OrganizationDripMembersTrialExpired:
            case EmailTemplateType.OrganizationDripTrialExpiredReminder:
            case EmailTemplateType.OrganizationDripWebshopNotRenewed:
            case EmailTemplateType.OrganizationDripMembersNotRenewed:
                return 'Drip';

            case EmailTemplateType.ExcelExportSucceeded:
            case EmailTemplateType.ExcelExportFailed:
                return 'Excel export';

            case EmailTemplateType.SignupAlreadyHasAccount:
            case EmailTemplateType.ForgotPasswordButNoAccount:
            case EmailTemplateType.ForgotPassword:
            case EmailTemplateType.DeleteAccountConfirmation:
            case EmailTemplateType.VerifyEmail:
            case EmailTemplateType.VerifyEmailWithoutCode:
                return 'Accounts en wachtwoorden';

            case EmailTemplateType.AdminInvitation:
            case EmailTemplateType.AdminInvitationNewUser:
                return 'Uitnodiging beheerder';

            case EmailTemplateType.UserBalanceIncreaseNotification:
            case EmailTemplateType.UserBalanceReminder:
                return 'Openstaand bedrag leden';

            case EmailTemplateType.OrganizationBalanceIncreaseNotification:
            case EmailTemplateType.OrganizationBalanceReminder:
                return 'Openstaand bedrag groepen';

            case EmailTemplateType.EventNotificationSubmittedCopy:
            case EmailTemplateType.EventNotificationSubmittedReviewer:
            case EmailTemplateType.EventNotificationAccepted:
            case EmailTemplateType.EventNotificationRejected:
                return $t('a4658017-52e9-4732-8570-2c60e5d6a5cd');
        }

        return 'Andere';
    }

    static allowPlatformLevel(type: EmailTemplateType): boolean {
        if (STAMHOOFD.userMode === 'platform') {
            if (type.includes('Drip') || type.includes('Expiration')) {
                return false;
            }
        }

        return true;
    }

    static allowOrganizationLevel(type: EmailTemplateType): boolean {
        switch (type) {
            case EmailTemplateType.DefaultMembersEmail: return true;
            case EmailTemplateType.DefaultReceivableBalancesEmail: return true;

            case EmailTemplateType.SavedMembersEmail: return true;
            case EmailTemplateType.SavedReceivableBalancesEmail: return true;

            case EmailTemplateType.RegistrationConfirmation: return true;
            case EmailTemplateType.RegistrationTransferDetails: return true;

            case EmailTemplateType.OrderConfirmationOnline: return true;
            case EmailTemplateType.OrderConfirmationTransfer: return true;
            case EmailTemplateType.OrderConfirmationPOS: return true;
            case EmailTemplateType.OrderReceivedTransfer: return true;
            case EmailTemplateType.TicketsConfirmation: return true;
            case EmailTemplateType.TicketsConfirmationTransfer: return true;
            case EmailTemplateType.TicketsConfirmationPOS: return true;
            case EmailTemplateType.TicketsReceivedTransfer: return true;

            case EmailTemplateType.UserBalanceIncreaseNotification: return true;
            case EmailTemplateType.UserBalanceReminder: return true;

            case EmailTemplateType.OrganizationBalanceIncreaseNotification: return true;
            case EmailTemplateType.OrganizationBalanceReminder: return true;
        }

        return false;
    }

    static getPlatformTypeDescription(type: EmailTemplateType): string | null {
        switch (type) {
            case EmailTemplateType.OrganizationUnstableDNS: return 'Na periodiek controleren blijken de DNS-instellingen van de domeinnaam van een vereniging instabiel te zijn.';
            case EmailTemplateType.OrganizationInvalidDNS: return 'Bij een routinecontrole blijken de DNS-instellingen van de domeinnaam van een vereniging ongeldig te zijn.';
            case EmailTemplateType.OrganizationValidDNS: return 'Na een controle blijken de DNS-instellingen van de domeinnaam van een vereniging geldig te zijn.';
            case EmailTemplateType.OrganizationStableDNS: return 'Na periodiek controleren blijken de DNS-instellingen van de domeinnaam van een vereniging terug stabiel te zijn.';
            case EmailTemplateType.OrganizationDNSSetupComplete: return 'De DNS-instellingen van de domeinnaam van een vereniging zijn correct ingesteld.';

            case EmailTemplateType.OrderOnlinePaymentFailed: return 'Wanneer een online betaling bij een webshop mislukt na een lange tijd wachten - zou zelden mogen voorkomen';

            case EmailTemplateType.ExcelExportSucceeded: return 'Bij lange Excel exports ontvang je een e-mail om jouw bestand te downloaden';
            case EmailTemplateType.ExcelExportFailed: return 'Als een lange Excel export toch mislukt, ontvang je een e-mail dat het mis ging';

            case EmailTemplateType.ForgotPasswordButNoAccount: return 'Als iemand een wachtwoord probeert te resetten, maar er geen account is met dat e-mailadres';
            case EmailTemplateType.ForgotPassword: return 'De e-mail met een link om je wachtwoord opnieuw in te stellen als je die bent vergeten';
            case EmailTemplateType.DeleteAccountConfirmation: return 'De e-mail als bevestiging als iemand aanvraagt om hun account te verwijderen.';
            case EmailTemplateType.VerifyEmail: return 'De e-mail die wordt verzonden om het e-mailadres te bevestigen als iemand een account aanmaakt.';
            case EmailTemplateType.VerifyEmailWithoutCode: return 'De e-mail die wordt verzonden naar de gebruiker om het e-mailadres te bevestigen als een beheerder dit wijzigt. Deze e-mail bevat geen bevestigingscode.';
            case EmailTemplateType.AdminInvitation: return 'De e-mail die een bestaande gebruiker ontvangt als hij toegevoegd wordt als beheerder.';
            case EmailTemplateType.AdminInvitationNewUser: return 'De e-mail die iemand zonder account ontvangt als hij toegevoegd wordt als beheerder.';

            case EmailTemplateType.SignupAlreadyHasAccount: return 'Als iemand probeert een account aan te maken, maar er al een account bestaat met dat e-mailadres';

            case EmailTemplateType.EventNotificationSubmittedCopy: return $t('fdf6dd9d-25f9-41bc-869b-beb2906aa77f');
            case EmailTemplateType.EventNotificationSubmittedReviewer: return $t('bd2321f7-caea-423e-a5e9-823023e74ec9');
            case EmailTemplateType.EventNotificationAccepted: return $t('1bb58aa1-e36e-4384-8c54-be3b71d77a3b');
            case EmailTemplateType.EventNotificationRejected: return $t('0b6949f6-80b7-4d48-9e1e-16bfb826014a');
        }

        return null;
    }

    static getTypeDescription(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.DefaultMembersEmail: return 'Als iemand een nieuwe e-mail opstelt, gericht aan leden, zal deze template standaard al klaar staan. Deze kan dan nog aangepast worden.';
            case EmailTemplateType.DefaultReceivableBalancesEmail: return 'Als iemand een nieuwe e-mail opstelt, gericht aan leden met openstaande bedragen, zal deze template standaard al klaar staan. Deze kan dan nog aangepast worden.';

            case EmailTemplateType.OrderNotification: return 'E-mail die webshop eigenaren ontvangen wanneer er een bestelling is geplaatst (indien ze die functie hebben ingeschakeld)';
            case EmailTemplateType.RegistrationConfirmation: return 'Leden en ouders (die toegang hebben of moeten krijgen) ontvangen deze e-mail nadat ze worden ingeschreven of zelf inschrijven.';

            case EmailTemplateType.OrderConfirmationOnline: return 'Wanneer een besteller online betaald (of totaalbedrag is 0 euro)';
            case EmailTemplateType.OrderConfirmationTransfer: return 'Wanneer een besteller kiest voor overschrijving - bevat nog eens de betaalinstructies als de betaling nog niet zou zijn gebeurd';
            case EmailTemplateType.OrderConfirmationPOS: return 'Wanneer een besteller kiest voor betaling ter plaatse/bij levering';
            case EmailTemplateType.OrderReceivedTransfer: return 'De e-mail die een besteller nog ontvangt als je de betaling hebt gemarkeerd als ontvangen (enkel bij betaalmethode overschrijving)';

            case EmailTemplateType.TicketsConfirmation: return 'Wanneer een besteller online betaald (of totaalbedrag is 0 euro)';
            case EmailTemplateType.TicketsConfirmationTransfer: return 'Wanneer een besteller kiest voor overschrijving - bevat nog eens de betaalinstructies als de betaling nog niet zou zijn gebeurd';
            case EmailTemplateType.TicketsConfirmationPOS: return 'Wanneer een besteller kiest voor betaling ter plaatse/bij levering';
            case EmailTemplateType.TicketsReceivedTransfer: return 'De e-mail die een besteller nog ontvangt als je de betaling hebt gemarkeerd als ontvangen (enkel bij betaalmethode overschrijving)';

            case EmailTemplateType.UserBalanceIncreaseNotification: return 'Automatische e-mail die \'s ochtends wordt verzonden als het saldo van een gebruiker omhoog is gegaan. Bijvoorbeeld als iemand een openstaand bedrag heeft toegevoegd bij een lid.';
            case EmailTemplateType.UserBalanceReminder: return 'Automatische e-mail die \'s ochtends wordt verzonden als een gebruiker nog steeds een openstaand bedrag heeft.';

            case EmailTemplateType.OrganizationBalanceIncreaseNotification: return 'Automatische e-mail die \'s ochtends wordt verzonden als het saldo van een groep omhoog is gegaan.';
            case EmailTemplateType.OrganizationBalanceReminder: return 'Automatische e-mail die \'s ochtends wordt verzonden als een groep nog steeds een openstaand bedrag heeft.';
        }

        return '';
    }

    static getSupportedReplacementsForType(type: EmailTemplateType): Replacement[] {
        if ([
            EmailTemplateType.EventNotificationSubmittedCopy,
            EmailTemplateType.EventNotificationSubmittedReviewer,
            EmailTemplateType.EventNotificationAccepted,
            EmailTemplateType.EventNotificationRejected,
        ].includes(type)) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.reviewUrl,
                ExampleReplacements.all.submitterName,
                ExampleReplacements.all.organizationName,
                ExampleReplacements.all.eventName,
                ExampleReplacements.all.dateRange,
                ...(type === EmailTemplateType.EventNotificationRejected ? [ExampleReplacements.all.feedbackText] : []),
            ];
        }

        if ([
            EmailTemplateType.DefaultReceivableBalancesEmail,
            EmailTemplateType.SavedReceivableBalancesEmail,
            EmailTemplateType.UserBalanceIncreaseNotification,
            EmailTemplateType.UserBalanceReminder,
            EmailTemplateType.OrganizationBalanceIncreaseNotification,
            EmailTemplateType.OrganizationBalanceReminder,
        ].includes(type)) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.paymentUrl,
                ExampleReplacements.all.outstandingBalance,
                ExampleReplacements.all.balanceTable,
                ExampleReplacements.all.objectName,
            ];
        }

        if ([
            EmailTemplateType.SavedMembersEmail,
            EmailTemplateType.DefaultMembersEmail,
        ].includes(type)) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.firstNameMember,
                ExampleReplacements.all.lastNameMember,
                ExampleReplacements.all.outstandingBalance,
                ExampleReplacements.all.balanceTable,
            ];
        }

        if (type === EmailTemplateType.SignupAlreadyHasAccount) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.resetUrl,
            ];
        }

        if (type === EmailTemplateType.ForgotPasswordButNoAccount) {
            return [
                // Name not available
                ExampleReplacements.all.email,
            ];
        }

        if (type === EmailTemplateType.DeleteAccountConfirmation) {
            return ExampleReplacements.default;
        }

        if (type === EmailTemplateType.ForgotPassword) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.resetUrl,
            ];
        }

        if (type === EmailTemplateType.VerifyEmail) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.confirmEmailUrl,
                ExampleReplacements.all.confirmEmailCode,
            ];
        }

        if (type === EmailTemplateType.VerifyEmailWithoutCode) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.confirmEmailUrl,
            ];
        }

        if (type === EmailTemplateType.AdminInvitation) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.platformOrOrganizationName,
                ExampleReplacements.all.inviterName,
                ExampleReplacements.all.validUntil,
                ExampleReplacements.all.signInUrl,
                ExampleReplacements.all.resetUrl,
            ];
        }

        if (type === EmailTemplateType.AdminInvitationNewUser) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.platformOrOrganizationName,
                ExampleReplacements.all.inviterName,
                ExampleReplacements.all.validUntil,
                ExampleReplacements.all.resetUrl,
            ];
        }

        if (type === EmailTemplateType.ExcelExportSucceeded) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.downloadUrl,
            ];
        }

        if (type === EmailTemplateType.ExcelExportFailed) {
            return [
                ...ExampleReplacements.default,
            ];
        }

        if (type === EmailTemplateType.RegistrationConfirmation) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.firstNameMember,
                ExampleReplacements.all.lastNameMember,
                ExampleReplacements.all.registerUrl,
                ExampleReplacements.all.groupName,
                ExampleReplacements.all.signInUrl,
                ExampleReplacements.all.unsubscribeUrl,
                ExampleReplacements.all.loginDetails,
            ];
        }

        if ([
            EmailTemplateType.OrganizationDNSSetupComplete,
            EmailTemplateType.OrganizationInvalidDNS,
            EmailTemplateType.OrganizationStableDNS,
            EmailTemplateType.OrganizationUnstableDNS,
            EmailTemplateType.OrganizationValidDNS,
        ].includes(type)) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.mailDomain,
            ];
        }

        if (type === EmailTemplateType.RegistrationTransferDetails) {
            return [
                ExampleReplacements.all.priceToPay,
                ExampleReplacements.all.paymentMethod,
                ExampleReplacements.all.transferDescription,
                ExampleReplacements.all.transferBankAccount,
                ExampleReplacements.all.transferBankCreditor,
                ExampleReplacements.all.overviewContext,
                ExampleReplacements.all.memberNames,
                ExampleReplacements.all.overviewTable,
                ExampleReplacements.all.paymentTable,
                ExampleReplacements.all.registerUrl,
                ExampleReplacements.all.organizationName,
                ExampleReplacements.all.signInUrl,
                ExampleReplacements.all.unsubscribeUrl,
                ExampleReplacements.all.loginDetails,
            ];
        }

        if ([
            EmailTemplateType.MembersExpirationReminder,
            EmailTemplateType.WebshopsExpirationReminder,
            EmailTemplateType.TrialMembersExpirationReminder,
            EmailTemplateType.TrialWebshopsExpirationReminder,
            EmailTemplateType.SingleWebshopExpirationReminder,
        ].includes(type)) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.packageName,
                ExampleReplacements.all.validUntil,
                ExampleReplacements.all.validUntilDate,
                ExampleReplacements.all.renewUrl,
                ExampleReplacements.all.unsubscribeUrl,
            ];
        }
        const sharedReplacements = [
            ...ExampleReplacements.default,
            ExampleReplacements.all.orderPrice,
            ExampleReplacements.all.orderStatus,
            ExampleReplacements.all.orderDetailsTable,
            ExampleReplacements.all.orderTable,
            ExampleReplacements.all.paymentTable,
            ExampleReplacements.all.orderUrl,
            ExampleReplacements.all.paymentMethod,
            ExampleReplacements.all.organizationName,
            ExampleReplacements.all.webshopName,
            ExampleReplacements.all.unsubscribeUrl,
        ];

        if (type !== EmailTemplateType.OrderOnlinePaymentFailed) {
            sharedReplacements.push(
                ExampleReplacements.all.nr,
            );
        }

        if (type === EmailTemplateType.OrderConfirmationTransfer || type === EmailTemplateType.TicketsConfirmationTransfer) {
            return [
                ...sharedReplacements,
                ExampleReplacements.all.transferDescription,
                ExampleReplacements.all.transferBankAccount,
                ExampleReplacements.all.transferBankCreditor,
            ];
        }

        return sharedReplacements;
    }
}
