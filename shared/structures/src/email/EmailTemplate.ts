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

    /**
     * Defaults
     */
    DefaultMembersEmail = 'DefaultMembersEmail',
    DefaultReceivableBalancesEmail = 'DefaultReceivableBalancesEmail',
    SavedReceivableBalancesEmail = 'SavedReceivableBalancesEmail',
    DefaultOrdersEmail = 'DefaultOrdersEmail',
    DefaultDocumentsEmail = 'DefaultDocumentsEmail',

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

        return null;
    }

    static isSavedEmail(type: EmailTemplateType): boolean {
        if (type === EmailTemplateType.SavedMembersEmail) {
            return true;
        }

        if (type === EmailTemplateType.SavedReceivableBalancesEmail) {
            return true;
        }

        if (type === EmailTemplateType.SavedDocumentsEmail) {
            return true;
        }

        return false;
    }

    static getTypeTitle(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.SavedMembersEmail: return $t(`8c609752-6cc2-4721-9bfc-8235eae583f5`);
            case EmailTemplateType.SavedReceivableBalancesEmail: return $t(`da9b79f1-f1e3-45c8-9ce9-2c28c47d8810`);
            case EmailTemplateType.SavedDocumentsEmail: return $t('e0675fb8-f471-43b0-b26f-776825da5e6b');

            case EmailTemplateType.DefaultMembersEmail: return $t(`32a7a328-9ba4-4ca5-9305-689fe2c81355`);
            case EmailTemplateType.DefaultReceivableBalancesEmail: return $t(`ed2ff298-5b4c-47df-99f6-1050b562637b`);
            case EmailTemplateType.DefaultOrdersEmail: return $t(`1c0b80d6-8ac3-4dc3-b3c3-13fe7257c9c7`);
            case EmailTemplateType.DefaultDocumentsEmail: return $t('1d5b6851-4dea-41ff-b66f-2a65a2772b10');

            case EmailTemplateType.MembersExpirationReminder: return $t(`53995057-1b3c-457a-b142-b7780152552a`);
            case EmailTemplateType.WebshopsExpirationReminder: return $t(`9128ebac-a394-422e-b1e6-c3d40f87e33b`);
            case EmailTemplateType.SingleWebshopExpirationReminder: return $t(`5c5eb58c-0d9c-41aa-93c8-645667848699`);
            case EmailTemplateType.TrialWebshopsExpirationReminder: return $t(`9628bc15-d020-4001-881d-1759bd3cb6f2`);
            case EmailTemplateType.TrialMembersExpirationReminder: return $t(`56f0799b-17fa-4b08-aaa3-82b2b74afef8`);
            case EmailTemplateType.OrderNotification: return $t(`65436d12-ab7a-417a-b346-6c2df4f862e1`);

            case EmailTemplateType.RegistrationConfirmation: return $t(`c93051a4-bf26-4715-9a4c-befd01c5f7c9`);
            case EmailTemplateType.RegistrationTransferDetails: return $t(`14804645-047f-484b-a271-189adae96edd`);

            case EmailTemplateType.OrderConfirmationOnline: return $t(`b9c92449-16c1-4253-851f-6a8c07110bf5`);
            case EmailTemplateType.OrderConfirmationTransfer: return $t(`519b8a09-e14e-440f-bba0-e109c8c7cd52`);
            case EmailTemplateType.OrderConfirmationPOS: return $t(`8c09a288-066d-4dda-b5fa-a6f23bd8c72b`);
            case EmailTemplateType.OrderReceivedTransfer: return $t(`788733ff-af2f-476b-bf79-6d4ee6cb34ff`);
            case EmailTemplateType.OrderOnlinePaymentFailed: return $t(`bcfa66de-6b15-4c07-b962-9bfc876fed2e`);
            case EmailTemplateType.TicketsConfirmation: return $t(`c345bde5-bdeb-40a8-a21f-11a2bb36f8c8`);
            case EmailTemplateType.TicketsConfirmationTransfer: return $t(`6a37c723-1559-44d0-b397-930689415081`);
            case EmailTemplateType.TicketsConfirmationPOS: return $t(`4ffb6a0e-35cb-44d3-b953-f54e3f979583`);
            case EmailTemplateType.TicketsReceivedTransfer: return $t(`a2eceded-1c1c-4b35-8525-0784de4d8390`);

            case EmailTemplateType.OrganizationUnstableDNS: return $t(`8529f137-47dd-4442-b12d-5906659071c8`);
            case EmailTemplateType.OrganizationInvalidDNS: return $t(`dd2e29cc-1ea9-4b35-a822-8f97c09c380a`);
            case EmailTemplateType.OrganizationValidDNS: return $t(`ce3bff53-877c-44e4-a121-cca3b2376ba2`);
            case EmailTemplateType.OrganizationStableDNS: return $t(`de599f7e-7f0e-446b-9421-e8238ac70e58`);
            case EmailTemplateType.OrganizationDNSSetupComplete: return $t(`4242c9bc-199d-4ad2-9ac1-56592957bee0`);

            case EmailTemplateType.OrganizationDripWelcome: return $t(`fa39ef03-53b4-4451-b2f4-44d58e81bcab`);
            case EmailTemplateType.OrganizationDripWebshopTrialCheckin: return $t(`231b16fc-c723-4db8-8827-dc9df8c9236d`);
            case EmailTemplateType.OrganizationDripMembersTrialCheckin: return $t(`72d098b9-7197-440c-8bc2-c88399cebac5`);
            case EmailTemplateType.OrganizationDripWebshopTrialExpired: return $t(`1fb39106-32e6-4ebc-89f2-85c8f88af892`);
            case EmailTemplateType.OrganizationDripMembersTrialExpired: return $t(`6f446cd8-074c-41f8-910d-aa7ae62e1b6f`);
            case EmailTemplateType.OrganizationDripTrialExpiredReminder: return $t(`c12b8ad2-3810-41c8-b69d-1eabcf56bef6`);
            case EmailTemplateType.OrganizationDripWebshopNotRenewed: return $t(`f0111f25-d429-4d36-914f-e4d86212d81f`);
            case EmailTemplateType.OrganizationDripMembersNotRenewed: return $t(`bc0968c7-9bab-4005-9f05-a0364a9d133d`);

            case EmailTemplateType.ExcelExportSucceeded: return $t(`f5525e39-0d76-4059-b800-71179d85cce4`);
            case EmailTemplateType.ExcelExportFailed: return $t(`cc614c08-fcbd-40bd-a852-1cb1b116a764`);

            case EmailTemplateType.SignupAlreadyHasAccount: return $t(`afa10626-9a93-4858-8edc-6558e036ca42`);
            case EmailTemplateType.ForgotPasswordButNoAccount: return $t(`29c387e2-6d0f-42d9-aa66-bfdc29b23f96`);
            case EmailTemplateType.ForgotPassword: return $t(`66176374-df16-49fb-a487-5269b97e7286`);
            case EmailTemplateType.DeleteAccountConfirmation: return $t(`79b7a72d-a624-43dd-9650-854cbca7e4b3`);
            case EmailTemplateType.VerifyEmail: return $t(`d9a67643-7954-4738-9078-0621025453ea`);
            case EmailTemplateType.VerifyEmailWithoutCode: return $t(`384b21d8-9ecc-419b-afea-a473a2b8ea0a`);
            case EmailTemplateType.AdminInvitation: return $t(`0950002e-2bd7-4451-90f3-34288c48e33b`);
            case EmailTemplateType.AdminInvitationNewUser: return $t(`886a88f7-075e-40dc-bc8d-a37f6868a3bb`);

            case EmailTemplateType.UserBalanceIncreaseNotification: return $t(`08fb134b-0352-430f-8d0d-f54b759a9230`);
            case EmailTemplateType.UserBalanceReminder: return $t(`dac4b0b8-dfcd-4cb9-9986-b0a2e95cf2a0`);

            case EmailTemplateType.OrganizationBalanceIncreaseNotification: return $t(`08fb134b-0352-430f-8d0d-f54b759a9230`);
            case EmailTemplateType.OrganizationBalanceReminder: return $t(`dac4b0b8-dfcd-4cb9-9986-b0a2e95cf2a0`);

            case EmailTemplateType.EventNotificationSubmittedCopy: return $t('9a9a7777-44ca-494b-9d15-c0192bc41a7f');
            case EmailTemplateType.EventNotificationSubmittedReviewer: return $t('ff2beaea-cb8f-4de8-ba1c-039b7ba20bc0');
            case EmailTemplateType.EventNotificationAccepted: return $t('c936748e-b6f9-4aa9-9822-77bd727501eb');
            case EmailTemplateType.EventNotificationRejected: return $t('01266433-c6b9-4c4b-b09f-b212cc0ce5a8');
            case EmailTemplateType.EventNotificationPartiallyAccepted: return $t('f24bc296-9945-4b12-a3b2-e5c1e7a7c52c');
        }
    }

    static getTypeCategory(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.SavedMembersEmail:
            case EmailTemplateType.SavedReceivableBalancesEmail:
            case EmailTemplateType.SavedDocumentsEmail:
                return $t(`074e2721-99c4-4825-b2be-55a97a33d722`);

            case EmailTemplateType.DefaultMembersEmail:
            case EmailTemplateType.DefaultReceivableBalancesEmail:
            case EmailTemplateType.DefaultOrdersEmail:
            case EmailTemplateType.DefaultDocumentsEmail:
                return $t(`0c35caa6-6240-4a92-9d89-78acf2c79fc0`);

            case EmailTemplateType.MembersExpirationReminder:
            case EmailTemplateType.WebshopsExpirationReminder:
            case EmailTemplateType.SingleWebshopExpirationReminder:
            case EmailTemplateType.TrialWebshopsExpirationReminder:
            case EmailTemplateType.TrialMembersExpirationReminder:
                return $t(`b53032c7-e96d-42ff-8d6f-d5b40c5fa700`);

            case EmailTemplateType.RegistrationConfirmation:
            case EmailTemplateType.RegistrationTransferDetails:
                return $t(`95ac7564-3fdd-4427-be59-51fd02606b76`);

            case EmailTemplateType.OrderNotification:
                return $t(`e38c0b49-b038-4c9c-9653-fe1e4a078226`);
            case EmailTemplateType.OrderConfirmationOnline:
            case EmailTemplateType.OrderConfirmationTransfer:
            case EmailTemplateType.OrderConfirmationPOS:
            case EmailTemplateType.OrderReceivedTransfer:
            case EmailTemplateType.OrderOnlinePaymentFailed:
                return $t(`ec252aa0-30df-4d49-9a37-a2ce6a0fc6dc`);
            case EmailTemplateType.TicketsConfirmation:
            case EmailTemplateType.TicketsConfirmationTransfer:
            case EmailTemplateType.TicketsConfirmationPOS:
            case EmailTemplateType.TicketsReceivedTransfer:
                return $t(`05ac8c30-f824-4269-aecd-b7226636e2de`);

            case EmailTemplateType.OrganizationUnstableDNS:
            case EmailTemplateType.OrganizationInvalidDNS:
            case EmailTemplateType.OrganizationValidDNS:
            case EmailTemplateType.OrganizationStableDNS:
            case EmailTemplateType.OrganizationDNSSetupComplete:
                return $t(`cbefe240-5d20-4b9a-8cbb-29286e3dae4d`);

            case EmailTemplateType.OrganizationDripWelcome:
            case EmailTemplateType.OrganizationDripWebshopTrialCheckin:
            case EmailTemplateType.OrganizationDripMembersTrialCheckin:
            case EmailTemplateType.OrganizationDripWebshopTrialExpired:
            case EmailTemplateType.OrganizationDripMembersTrialExpired:
            case EmailTemplateType.OrganizationDripTrialExpiredReminder:
            case EmailTemplateType.OrganizationDripWebshopNotRenewed:
            case EmailTemplateType.OrganizationDripMembersNotRenewed:
                return $t(`cb57875f-a2b7-4076-8f32-a9a970f68907`);

            case EmailTemplateType.ExcelExportSucceeded:
            case EmailTemplateType.ExcelExportFailed:
                return $t(`b47abc59-c79d-4d69-b961-de80e562e8f2`);

            case EmailTemplateType.SignupAlreadyHasAccount:
            case EmailTemplateType.ForgotPasswordButNoAccount:
            case EmailTemplateType.ForgotPassword:
            case EmailTemplateType.DeleteAccountConfirmation:
            case EmailTemplateType.VerifyEmail:
            case EmailTemplateType.VerifyEmailWithoutCode:
                return $t(`e752d93c-4293-4d36-b958-f74b15322824`);

            case EmailTemplateType.AdminInvitation:
            case EmailTemplateType.AdminInvitationNewUser:
                return $t(`684eae18-34f6-4fb7-a45e-eceecee9b034`);

            case EmailTemplateType.UserBalanceIncreaseNotification:
            case EmailTemplateType.UserBalanceReminder:
                return $t(`0e2b8e4a-0043-44f2-aef4-832cb1561209`);

            case EmailTemplateType.OrganizationBalanceIncreaseNotification:
            case EmailTemplateType.OrganizationBalanceReminder:
                return $t(`d1f041f4-33d2-4cdb-b034-2d1c149f8a7a`);

            case EmailTemplateType.EventNotificationSubmittedCopy:
            case EmailTemplateType.EventNotificationSubmittedReviewer:
            case EmailTemplateType.EventNotificationAccepted:
            case EmailTemplateType.EventNotificationRejected:
            case EmailTemplateType.EventNotificationPartiallyAccepted:
                return $t('a4658017-52e9-4732-8570-2c60e5d6a5cd');
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

            case EmailTemplateType.SavedMembersEmail: return true;
            case EmailTemplateType.SavedReceivableBalancesEmail: return true;
            case EmailTemplateType.SavedDocumentsEmail: return true;

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
            case EmailTemplateType.OrganizationUnstableDNS: return $t(`c14e79ad-18ab-4295-a8b9-fda330e981ec`);
            case EmailTemplateType.OrganizationInvalidDNS: return $t(`6348587f-8d3e-4a13-8b52-5fa459366fee`);
            case EmailTemplateType.OrganizationValidDNS: return $t(`f8f36233-df20-42bd-b9a4-f53005107825`);
            case EmailTemplateType.OrganizationStableDNS: return $t(`e82be6d7-1cde-4da3-8018-1e2c796a3f13`);
            case EmailTemplateType.OrganizationDNSSetupComplete: return $t(`6110db94-d89d-43d0-9c1c-d3e71253a795`);

            case EmailTemplateType.OrderOnlinePaymentFailed: return $t(`481efc5e-0efc-4d3f-97e3-ccaa503172df`);

            case EmailTemplateType.ExcelExportSucceeded: return $t(`b7ca22c7-88f3-4570-bf8d-8654f2b375ac`);
            case EmailTemplateType.ExcelExportFailed: return $t(`400a95c7-311c-4ea4-8f75-d96dd60cf6d9`);

            case EmailTemplateType.ForgotPasswordButNoAccount: return $t(`304410b8-459c-4c76-9832-17a2836fad58`);
            case EmailTemplateType.ForgotPassword: return $t(`59b78a8b-79f0-4648-a868-72f4be8bbc25`);
            case EmailTemplateType.DeleteAccountConfirmation: return $t(`08de825e-af69-4243-93a4-9056121ad884`);
            case EmailTemplateType.VerifyEmail: return $t(`4d6ab026-8da3-4193-bd98-d695b6401c38`);
            case EmailTemplateType.VerifyEmailWithoutCode: return $t(`4e26d3bb-92fa-49f1-87e0-961acda3d4ea`);
            case EmailTemplateType.AdminInvitation: return $t(`b65c6f13-3d19-43f0-81b2-6acc6a40fdb5`);
            case EmailTemplateType.AdminInvitationNewUser: return $t(`d70ea85b-9d97-4924-94e0-1722110c9504`);

            case EmailTemplateType.SignupAlreadyHasAccount: return $t(`9b357a68-47d7-410f-a2a1-b9a0c3df7eee`);

            case EmailTemplateType.EventNotificationSubmittedCopy: return $t('fdf6dd9d-25f9-41bc-869b-beb2906aa77f');
            case EmailTemplateType.EventNotificationSubmittedReviewer: return $t('bd2321f7-caea-423e-a5e9-823023e74ec9');
            case EmailTemplateType.EventNotificationAccepted: return $t('1bb58aa1-e36e-4384-8c54-be3b71d77a3b');
            case EmailTemplateType.EventNotificationRejected: return $t('0b6949f6-80b7-4d48-9e1e-16bfb826014a');
            case EmailTemplateType.EventNotificationPartiallyAccepted: return $t('56dbf1c6-1651-41dc-95c5-4a9fece298c2');
        }

        return null;
    }

    static getTypeDescription(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.DefaultMembersEmail: return $t(`50a8f3bd-d967-43bb-b0e8-a918f4d3e85a`);
            case EmailTemplateType.DefaultReceivableBalancesEmail: return $t(`9108cbae-cb61-41f6-9838-4456f3255669`);
            case EmailTemplateType.DefaultOrdersEmail: return $t(`09754a12-7918-47a6-a783-dde118f45368`);
            case EmailTemplateType.DefaultDocumentsEmail: return $t('665dce38-70a1-450b-a65b-f41f930d88da');

            case EmailTemplateType.OrderNotification: return $t(`e735ea80-2385-4377-89f9-645505d50e2f`);
            case EmailTemplateType.RegistrationConfirmation: return $t(`474e3ddc-7d96-49f0-9de6-4f132815db99`);

            case EmailTemplateType.OrderConfirmationOnline: return $t(`26a783b6-b459-4a3f-992d-111e52fec353`);
            case EmailTemplateType.OrderConfirmationTransfer: return $t(`fb5241ef-b085-4c4d-9d8a-5ac799ea9891`);
            case EmailTemplateType.OrderConfirmationPOS: return $t(`4ca2c5c7-44ba-4266-8189-b3c5ee7b9af8`);
            case EmailTemplateType.OrderReceivedTransfer: return $t(`3b252c1e-73af-4ad5-af1c-df0b5bd6dcac`);

            case EmailTemplateType.TicketsConfirmation: return $t(`26a783b6-b459-4a3f-992d-111e52fec353`);
            case EmailTemplateType.TicketsConfirmationTransfer: return $t(`fb5241ef-b085-4c4d-9d8a-5ac799ea9891`);
            case EmailTemplateType.TicketsConfirmationPOS: return $t(`4ca2c5c7-44ba-4266-8189-b3c5ee7b9af8`);
            case EmailTemplateType.TicketsReceivedTransfer: return $t(`3b252c1e-73af-4ad5-af1c-df0b5bd6dcac`);

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
