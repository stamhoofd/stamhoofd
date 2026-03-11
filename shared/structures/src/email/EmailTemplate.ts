import { AnyDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Replacement } from '../endpoints/EmailRequest.js';
import { EmailRecipientFilterType } from './Email.js';
import { ExampleReplacements } from './exampleReplacements.js';

export enum EmailTemplateType {
    /**
     * Template created by the user to send manually
     */
    SavedMembersEmail = 'SavedMembersEmail',
    SavedDocumentsEmail = 'SavedDocumentsEmail',
    SavedPaymentsEmail = 'SavedPaymentsEmail',

    /**
     * Defaults
     */
    DefaultMembersEmail = 'DefaultMembersEmail',
    DefaultReceivableBalancesEmail = 'DefaultReceivableBalancesEmail',
    SavedReceivableBalancesEmail = 'SavedReceivableBalancesEmail',
    DefaultOrdersEmail = 'DefaultOrdersEmail',
    DefaultDocumentsEmail = 'DefaultDocumentsEmail',
    DefaultPaymentsEmail = 'DefaultPaymentsEmail',

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
    EventNotificationPartiallyAccepted = 'EventNotificationPartiallyAccepted',
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
        if (type === EmailRecipientFilterType.Members || type === EmailRecipientFilterType.MemberParents || type === EmailRecipientFilterType.RegistrationMembers || type === EmailRecipientFilterType.RegistrationParents) {
            return EmailTemplateType.DefaultMembersEmail;
        }

        if (type === EmailRecipientFilterType.ReceivableBalances) {
            return EmailTemplateType.DefaultReceivableBalancesEmail;
        }

        if (type === EmailRecipientFilterType.Orders) {
            return EmailTemplateType.DefaultOrdersEmail;
        }

        if (type === EmailRecipientFilterType.Documents) {
            return EmailTemplateType.DefaultDocumentsEmail;
        }

        if (type === EmailRecipientFilterType.Payment || type === EmailRecipientFilterType.PaymentOrganization) {
            return EmailTemplateType.DefaultPaymentsEmail;
        }

        return null;
    }

    static getSavedForRecipient(type: EmailRecipientFilterType): EmailTemplateType | null {
        if (type === EmailRecipientFilterType.Members || type === EmailRecipientFilterType.MemberParents || type === EmailRecipientFilterType.RegistrationMembers || type === EmailRecipientFilterType.RegistrationParents) {
            return EmailTemplateType.SavedMembersEmail;
        }

        if (type === EmailRecipientFilterType.ReceivableBalances) {
            return EmailTemplateType.SavedReceivableBalancesEmail;
        }

        if (type === EmailRecipientFilterType.Documents) {
            return EmailTemplateType.SavedDocumentsEmail;
        }

        if (type === EmailRecipientFilterType.Payment || type === EmailRecipientFilterType.PaymentOrganization) {
            return EmailTemplateType.SavedPaymentsEmail;
        }

        return null;
    }

    static isSavedEmail(type: EmailTemplateType): boolean {
        const savedEmailTemplateTypes = new Set<EmailTemplateType>([
            EmailTemplateType.SavedMembersEmail,
            EmailTemplateType.SavedReceivableBalancesEmail,
            EmailTemplateType.SavedDocumentsEmail,
            EmailTemplateType.SavedPaymentsEmail,
        ]);

        return savedEmailTemplateTypes.has(type);
    }

    static getTypeTitle(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.SavedMembersEmail: return $t(`%p9`);
            case EmailTemplateType.SavedReceivableBalancesEmail: return $t(`%pA`);
            case EmailTemplateType.SavedDocumentsEmail: return $t('%1KM');
            case EmailTemplateType.SavedPaymentsEmail: return $t('%1N3');

            case EmailTemplateType.DefaultMembersEmail: return $t(`%pB`);
            case EmailTemplateType.DefaultReceivableBalancesEmail: return $t(`%pC`);
            case EmailTemplateType.DefaultOrdersEmail: return $t(`%pD`);
            case EmailTemplateType.DefaultDocumentsEmail: return $t('%1KN');
            case EmailTemplateType.DefaultPaymentsEmail: return $t('%1N4');

            case EmailTemplateType.MembersExpirationReminder: return $t(`%pE`);
            case EmailTemplateType.WebshopsExpirationReminder: return $t(`%pF`);
            case EmailTemplateType.SingleWebshopExpirationReminder: return $t(`%pG`);
            case EmailTemplateType.TrialWebshopsExpirationReminder: return $t(`%pH`);
            case EmailTemplateType.TrialMembersExpirationReminder: return $t(`%pI`);
            case EmailTemplateType.OrderNotification: return $t(`%pJ`);

            case EmailTemplateType.RegistrationConfirmation: return $t(`%pK`);
            case EmailTemplateType.RegistrationTransferDetails: return $t(`%pL`);

            case EmailTemplateType.OrderConfirmationOnline: return $t(`%pM`);
            case EmailTemplateType.OrderConfirmationTransfer: return $t(`%pN`);
            case EmailTemplateType.OrderConfirmationPOS: return $t(`%pO`);
            case EmailTemplateType.OrderReceivedTransfer: return $t(`%pP`);
            case EmailTemplateType.OrderOnlinePaymentFailed: return $t(`%pQ`);
            case EmailTemplateType.TicketsConfirmation: return $t(`%pR`);
            case EmailTemplateType.TicketsConfirmationTransfer: return $t(`%pS`);
            case EmailTemplateType.TicketsConfirmationPOS: return $t(`%pT`);
            case EmailTemplateType.TicketsReceivedTransfer: return $t(`%pU`);

            case EmailTemplateType.OrganizationUnstableDNS: return $t(`%pV`);
            case EmailTemplateType.OrganizationInvalidDNS: return $t(`%pW`);
            case EmailTemplateType.OrganizationValidDNS: return $t(`%pX`);
            case EmailTemplateType.OrganizationStableDNS: return $t(`%pY`);
            case EmailTemplateType.OrganizationDNSSetupComplete: return $t(`%pZ`);

            case EmailTemplateType.OrganizationDripWelcome: return $t(`%pa`);
            case EmailTemplateType.OrganizationDripWebshopTrialCheckin: return $t(`%pb`);
            case EmailTemplateType.OrganizationDripMembersTrialCheckin: return $t(`%pc`);
            case EmailTemplateType.OrganizationDripWebshopTrialExpired: return $t(`%pd`);
            case EmailTemplateType.OrganizationDripMembersTrialExpired: return $t(`%pe`);
            case EmailTemplateType.OrganizationDripTrialExpiredReminder: return $t(`%pf`);
            case EmailTemplateType.OrganizationDripWebshopNotRenewed: return $t(`%pg`);
            case EmailTemplateType.OrganizationDripMembersNotRenewed: return $t(`%ph`);

            case EmailTemplateType.ExcelExportSucceeded: return $t(`%pi`);
            case EmailTemplateType.ExcelExportFailed: return $t(`%pj`);

            case EmailTemplateType.SignupAlreadyHasAccount: return $t(`%pk`);
            case EmailTemplateType.ForgotPasswordButNoAccount: return $t(`%pl`);
            case EmailTemplateType.ForgotPassword: return $t(`%uz`);
            case EmailTemplateType.DeleteAccountConfirmation: return $t(`%pm`);
            case EmailTemplateType.VerifyEmail: return $t(`%pn`);
            case EmailTemplateType.VerifyEmailWithoutCode: return $t(`%po`);
            case EmailTemplateType.AdminInvitation: return $t(`%pp`);
            case EmailTemplateType.AdminInvitationNewUser: return $t(`%pq`);

            case EmailTemplateType.UserBalanceIncreaseNotification: return $t(`%pr`);
            case EmailTemplateType.UserBalanceReminder: return $t(`%ps`);

            case EmailTemplateType.OrganizationBalanceIncreaseNotification: return $t(`%pr`);
            case EmailTemplateType.OrganizationBalanceReminder: return $t(`%ps`);

            case EmailTemplateType.EventNotificationSubmittedCopy: return $t('%Ai');
            case EmailTemplateType.EventNotificationSubmittedReviewer: return $t('%Aj');
            case EmailTemplateType.EventNotificationAccepted: return $t('%Ak');
            case EmailTemplateType.EventNotificationRejected: return $t('%Al');
            case EmailTemplateType.EventNotificationPartiallyAccepted: return $t('%Cl');
        }
    }

    static getTypeCategory(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.SavedMembersEmail:
            case EmailTemplateType.SavedReceivableBalancesEmail:
            case EmailTemplateType.SavedPaymentsEmail:
            case EmailTemplateType.SavedDocumentsEmail:
                return $t(`%pt`);

            case EmailTemplateType.DefaultMembersEmail:
            case EmailTemplateType.DefaultReceivableBalancesEmail:
            case EmailTemplateType.DefaultOrdersEmail:
            case EmailTemplateType.DefaultPaymentsEmail:
            case EmailTemplateType.DefaultDocumentsEmail:
                return $t(`%Q`);

            case EmailTemplateType.MembersExpirationReminder:
            case EmailTemplateType.WebshopsExpirationReminder:
            case EmailTemplateType.SingleWebshopExpirationReminder:
            case EmailTemplateType.TrialWebshopsExpirationReminder:
            case EmailTemplateType.TrialMembersExpirationReminder:
                return $t(`%1v`);

            case EmailTemplateType.RegistrationConfirmation:
            case EmailTemplateType.RegistrationTransferDetails:
                return $t(`%1EI`);

            case EmailTemplateType.OrderNotification:
                return $t(`%2N`);
            case EmailTemplateType.OrderConfirmationOnline:
            case EmailTemplateType.OrderConfirmationTransfer:
            case EmailTemplateType.OrderConfirmationPOS:
            case EmailTemplateType.OrderReceivedTransfer:
            case EmailTemplateType.OrderOnlinePaymentFailed:
                return $t(`%pu`);
            case EmailTemplateType.TicketsConfirmation:
            case EmailTemplateType.TicketsConfirmationTransfer:
            case EmailTemplateType.TicketsConfirmationPOS:
            case EmailTemplateType.TicketsReceivedTransfer:
                return $t(`%pv`);

            case EmailTemplateType.OrganizationUnstableDNS:
            case EmailTemplateType.OrganizationInvalidDNS:
            case EmailTemplateType.OrganizationValidDNS:
            case EmailTemplateType.OrganizationStableDNS:
            case EmailTemplateType.OrganizationDNSSetupComplete:
                return $t(`%26`);

            case EmailTemplateType.OrganizationDripWelcome:
            case EmailTemplateType.OrganizationDripWebshopTrialCheckin:
            case EmailTemplateType.OrganizationDripMembersTrialCheckin:
            case EmailTemplateType.OrganizationDripWebshopTrialExpired:
            case EmailTemplateType.OrganizationDripMembersTrialExpired:
            case EmailTemplateType.OrganizationDripTrialExpiredReminder:
            case EmailTemplateType.OrganizationDripWebshopNotRenewed:
            case EmailTemplateType.OrganizationDripMembersNotRenewed:
                return $t(`%25`);

            case EmailTemplateType.ExcelExportSucceeded:
            case EmailTemplateType.ExcelExportFailed:
                return $t(`%1u`);

            case EmailTemplateType.SignupAlreadyHasAccount:
            case EmailTemplateType.ForgotPasswordButNoAccount:
            case EmailTemplateType.ForgotPassword:
            case EmailTemplateType.DeleteAccountConfirmation:
            case EmailTemplateType.VerifyEmail:
            case EmailTemplateType.VerifyEmailWithoutCode:
                return $t(`%pw`);

            case EmailTemplateType.AdminInvitation:
            case EmailTemplateType.AdminInvitationNewUser:
                return $t(`%px`);

            case EmailTemplateType.UserBalanceIncreaseNotification:
            case EmailTemplateType.UserBalanceReminder:
                return $t(`%py`);

            case EmailTemplateType.OrganizationBalanceIncreaseNotification:
            case EmailTemplateType.OrganizationBalanceReminder:
                return $t(`%pz`);

            case EmailTemplateType.EventNotificationSubmittedCopy:
            case EmailTemplateType.EventNotificationSubmittedReviewer:
            case EmailTemplateType.EventNotificationAccepted:
            case EmailTemplateType.EventNotificationRejected:
            case EmailTemplateType.EventNotificationPartiallyAccepted:
                return $t('%CV');
        }
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
            case EmailTemplateType.DefaultOrdersEmail: return true;
            case EmailTemplateType.DefaultDocumentsEmail: return true;
            case EmailTemplateType.DefaultPaymentsEmail: return true;

            case EmailTemplateType.SavedMembersEmail: return true;
            case EmailTemplateType.SavedReceivableBalancesEmail: return true;
            case EmailTemplateType.SavedDocumentsEmail: return true;
            case EmailTemplateType.SavedPaymentsEmail: return true;

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
            case EmailTemplateType.OrganizationUnstableDNS: return $t(`%q0`);
            case EmailTemplateType.OrganizationInvalidDNS: return $t(`%q1`);
            case EmailTemplateType.OrganizationValidDNS: return $t(`%q2`);
            case EmailTemplateType.OrganizationStableDNS: return $t(`%q3`);
            case EmailTemplateType.OrganizationDNSSetupComplete: return $t(`%q4`);

            case EmailTemplateType.OrderOnlinePaymentFailed: return $t(`%q5`);

            case EmailTemplateType.ExcelExportSucceeded: return $t(`%q6`);
            case EmailTemplateType.ExcelExportFailed: return $t(`%q7`);

            case EmailTemplateType.ForgotPasswordButNoAccount: return $t(`%q8`);
            case EmailTemplateType.ForgotPassword: return $t(`%q9`);
            case EmailTemplateType.DeleteAccountConfirmation: return $t(`%qA`);
            case EmailTemplateType.VerifyEmail: return $t(`%qB`);
            case EmailTemplateType.VerifyEmailWithoutCode: return $t(`%qC`);
            case EmailTemplateType.AdminInvitation: return $t(`%qD`);
            case EmailTemplateType.AdminInvitationNewUser: return $t(`%qE`);

            case EmailTemplateType.SignupAlreadyHasAccount: return $t(`%qF`);

            case EmailTemplateType.EventNotificationSubmittedCopy: return $t('%Am');
            case EmailTemplateType.EventNotificationSubmittedReviewer: return $t('%An');
            case EmailTemplateType.EventNotificationAccepted: return $t('%Ao');
            case EmailTemplateType.EventNotificationRejected: return $t('%Ap');
            case EmailTemplateType.EventNotificationPartiallyAccepted: return $t('%Cm');
        }

        return null;
    }

    /**
     * Return true if this template type contains recipient types where EmailRecipientFilter.canShowInMemberPortal = true.
     * This means that you can send an email that will also be visible in the member portal. When this is the case, you should be able to add a block to
     * an email that is only visible when sent via email.
     *
     * Note: please also update EmailRecipientFilter.canShowInMemberPortal
     * @returns
     */
    static canAddEmailOnlyContent(type: EmailTemplateType): boolean {
        switch (type) {
            case EmailTemplateType.SavedMembersEmail:
            case EmailTemplateType.SavedDocumentsEmail:
            case EmailTemplateType.SavedPaymentsEmail:
            case EmailTemplateType.DefaultDocumentsEmail:
            case EmailTemplateType.UserBalanceReminder: // special case because it is sent via a cron
            case EmailTemplateType.UserBalanceIncreaseNotification:
            case EmailTemplateType.DefaultPaymentsEmail:
            case EmailTemplateType.DefaultMembersEmail: {
                return true;
            }
        }

        return false;
    }

    static getTypeDescription(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.DefaultMembersEmail: return $t(`%qG`);
            case EmailTemplateType.DefaultReceivableBalancesEmail: return $t(`%qH`);
            case EmailTemplateType.DefaultOrdersEmail: return $t(`%qI`);
            case EmailTemplateType.DefaultDocumentsEmail: return $t('%1KO');
            case EmailTemplateType.DefaultPaymentsEmail: return $t('%1N5');

            case EmailTemplateType.OrderNotification: return $t(`%qJ`);
            case EmailTemplateType.RegistrationConfirmation: return $t(`%qK`);

            case EmailTemplateType.OrderConfirmationOnline: return $t(`%qL`);
            case EmailTemplateType.OrderConfirmationTransfer: return $t(`%qM`);
            case EmailTemplateType.OrderConfirmationPOS: return $t(`%qN`);
            case EmailTemplateType.OrderReceivedTransfer: return $t(`%qO`);

            case EmailTemplateType.TicketsConfirmation: return $t(`%qL`);
            case EmailTemplateType.TicketsConfirmationTransfer: return $t(`%qM`);
            case EmailTemplateType.TicketsConfirmationPOS: return $t(`%qN`);
            case EmailTemplateType.TicketsReceivedTransfer: return $t(`%qO`);

            case EmailTemplateType.UserBalanceIncreaseNotification: return $t('Automatische e-mail die \'s ochtends wordt verzonden als het saldo van een gebruiker omhoog is gegaan. Bijvoorbeeld als iemand een openstaand bedrag heeft toegevoegd bij een lid.');
            case EmailTemplateType.UserBalanceReminder: return $t('Automatische e-mail die \'s ochtends wordt verzonden als een gebruiker nog steeds een openstaand bedrag heeft.');

            case EmailTemplateType.OrganizationBalanceIncreaseNotification: return $t('Automatische e-mail die \'s ochtends wordt verzonden als het saldo van een groep omhoog is gegaan.');
            case EmailTemplateType.OrganizationBalanceReminder: return $t('Automatische e-mail die \'s ochtends wordt verzonden als een groep nog steeds een openstaand bedrag heeft.');
        }

        return '';
    }

    static getSupportedReplacementsForType(type: EmailTemplateType): Replacement[] {
        if ([
            EmailTemplateType.EventNotificationSubmittedCopy,
            EmailTemplateType.EventNotificationSubmittedReviewer,
            EmailTemplateType.EventNotificationAccepted,
            EmailTemplateType.EventNotificationRejected,
            EmailTemplateType.EventNotificationPartiallyAccepted,
        ].includes(type)) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.reviewUrl,
                ExampleReplacements.all.submitterName,
                ExampleReplacements.all.organizationName,
                ExampleReplacements.all.eventName,
                ExampleReplacements.all.dateRange,
                ...(type === EmailTemplateType.EventNotificationRejected || type === EmailTemplateType.EventNotificationPartiallyAccepted ? [ExampleReplacements.all.feedbackText] : []),
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
            EmailTemplateType.DefaultDocumentsEmail,
            EmailTemplateType.SavedDocumentsEmail,
        ].includes(type)) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.firstNameMember,
                ExampleReplacements.all.lastNameMember,
                ExampleReplacements.all.outstandingBalance,
                ExampleReplacements.all.loginDetails,
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
                ...ExampleReplacements.default,
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

        if (type === EmailTemplateType.DefaultPaymentsEmail || type === EmailTemplateType.SavedPaymentsEmail) {
            return [
                ...ExampleReplacements.default,
                ExampleReplacements.all.priceToPay,
                ExampleReplacements.all.paymentMethod,
                ExampleReplacements.all.overviewTable,
                ExampleReplacements.all.paymentTable,
                ExampleReplacements.all.overviewContext,
                ExampleReplacements.all.paymentData,
                ExampleReplacements.all.paymentUrl,
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
