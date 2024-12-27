import { AnyDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Email, EmailRecipientFilterType } from './Email.js';
import { Replacement } from '../endpoints/EmailRequest.js';
import { DefaultExampleReplacements, ExampleReplacements } from './exampleReplacements.js';

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

    /**
     * A reminder e-mail to the user that their balance has to be paid.
     */
    UserBalanceReminder = 'UserBalanceReminder',
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
                return 'Openstaand bedrag';
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
            case EmailTemplateType.UserBalanceReminder: return 'Automatische e-mail die \'s ochtends wordt verzonden als een gebruiker nog een openstaand bedrag heeft.';
        }

        return '';
    }

    static getSupportedReplacementsForType(type: EmailTemplateType): Replacement[] {
        if ([
            EmailTemplateType.DefaultReceivableBalancesEmail,
            EmailTemplateType.SavedReceivableBalancesEmail,
            EmailTemplateType.UserBalanceIncreaseNotification,
            EmailTemplateType.UserBalanceReminder,
        ].includes(type)) {
            return [
                ...DefaultExampleReplacements,
                ExampleReplacements.paymentUrl,
                ExampleReplacements.outstandingBalance,
                ExampleReplacements.balanceTable,
            ];
        }

        if ([
            EmailTemplateType.SavedMembersEmail,
            EmailTemplateType.DefaultMembersEmail,
        ].includes(type)) {
            return [
                ...DefaultExampleReplacements,
                ExampleReplacements.firstNameMember,
                ExampleReplacements.lastNameMember,
                ExampleReplacements.outstandingBalance,
                ExampleReplacements.balanceTable,
            ];
        }

        if (type === EmailTemplateType.SignupAlreadyHasAccount) {
            return [
                ...DefaultExampleReplacements,
                ExampleReplacements.resetUrl,
            ];
        }

        if (type === EmailTemplateType.ForgotPasswordButNoAccount) {
            return [
                // Name not available
                ExampleReplacements.email,
            ];
        }

        if (type === EmailTemplateType.DeleteAccountConfirmation) {
            return DefaultExampleReplacements;
        }

        if (type === EmailTemplateType.ForgotPassword) {
            return [
                ...DefaultExampleReplacements,
                ExampleReplacements.resetUrl,
            ];
        }

        if (type === EmailTemplateType.VerifyEmail) {
            return [
                ...DefaultExampleReplacements,
                ExampleReplacements.confirmEmailUrl,
                ExampleReplacements.confirmEmailCode,
            ];
        }

        if (type === EmailTemplateType.VerifyEmailWithoutCode) {
            return [
                ...DefaultExampleReplacements,
                ExampleReplacements.confirmEmailUrl,
            ];
        }

        if (type === EmailTemplateType.AdminInvitation) {
            return [
                ...DefaultExampleReplacements,
                ExampleReplacements.platformOrOrganizationName,
                ExampleReplacements.inviterName,
                ExampleReplacements.validUntil,
                ExampleReplacements.signInUrl,
                ExampleReplacements.resetUrl,
            ];
        }

        if (type === EmailTemplateType.AdminInvitationNewUser) {
            return [
                ...DefaultExampleReplacements,
                ExampleReplacements.platformOrOrganizationName,
                ExampleReplacements.inviterName,
                ExampleReplacements.validUntil,
                ExampleReplacements.resetUrl,
            ];
        }

        if (type === EmailTemplateType.ExcelExportSucceeded) {
            return [
                ...DefaultExampleReplacements,
                ExampleReplacements.downloadUrl,
            ];
        }

        if (type === EmailTemplateType.ExcelExportFailed) {
            return [
                ...DefaultExampleReplacements,
            ];
        }

        if (type === EmailTemplateType.RegistrationConfirmation) {
            return [
                ...DefaultExampleReplacements,
                ExampleReplacements.firstNameMember,
                ExampleReplacements.lastNameMember,
                ExampleReplacements.registerUrl,
                ExampleReplacements.groupName,
                ExampleReplacements.signInUrl,
                ExampleReplacements.unsubscribeUrl,
                ExampleReplacements.loginDetails,
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
                ...DefaultExampleReplacements,
                ExampleReplacements.mailDomain,
            ];
        }

        if (type === EmailTemplateType.RegistrationTransferDetails) {
            return [
                ExampleReplacements.priceToPay,
                ExampleReplacements.paymentMethod,
                ExampleReplacements.transferDescription,
                ExampleReplacements.transferBankAccount,
                ExampleReplacements.transferBankCreditor,
                ExampleReplacements.overviewContext,
                ExampleReplacements.memberNames,
                ExampleReplacements.overviewTable,
                ExampleReplacements.paymentTable,
                ExampleReplacements.registerUrl,
                ExampleReplacements.organizationName,
                ExampleReplacements.signInUrl,
                ExampleReplacements.unsubscribeUrl,
                ExampleReplacements.loginDetails,
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
                ...DefaultExampleReplacements,
                ExampleReplacements.packageName,
                ExampleReplacements.validUntil,
                ExampleReplacements.validUntilDate,
                ExampleReplacements.renewUrl,
                ExampleReplacements.unsubscribeUrl,
            ];
        }
        const sharedReplacements = [
            ...DefaultExampleReplacements,
            ExampleReplacements.orderPrice,
            ExampleReplacements.orderStatus,
            ExampleReplacements.orderDetailsTable,
            ExampleReplacements.orderTable,
            ExampleReplacements.paymentTable,
            ExampleReplacements.orderUrl,
            ExampleReplacements.paymentMethod,
            ExampleReplacements.organizationName,
            ExampleReplacements.webshopName,
            ExampleReplacements.unsubscribeUrl,
        ];

        if (type !== EmailTemplateType.OrderOnlinePaymentFailed) {
            sharedReplacements.push(
                ExampleReplacements.nr,
            );
        }

        if (type === EmailTemplateType.OrderConfirmationTransfer || type === EmailTemplateType.TicketsConfirmationTransfer) {
            return [
                ...sharedReplacements,
                ExampleReplacements.transferDescription,
                ExampleReplacements.transferBankAccount,
                ExampleReplacements.transferBankCreditor,
            ];
        }

        return sharedReplacements;
    }
}
