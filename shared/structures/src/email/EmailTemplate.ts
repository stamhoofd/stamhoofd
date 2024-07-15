import { AnyDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";
import { EmailRecipientFilterType } from "./Email";

export enum EmailTemplateType {
    /**
     * Template created by the user to send manually
     */
    SavedMembersEmail = "SavedMembersEmail",

    /**
     * Defaults
     */
    DefaultMembersEmail = "DefaultMembersEmail",

    // 
    MembersExpirationReminder = "MembersExpirationReminder",
    WebshopsExpirationReminder = "WebshopsExpirationReminder",
    SingleWebshopExpirationReminder = "SingleWebshopExpirationReminder",
    TrialWebshopsExpirationReminder = "TrialWebshopsExpirationReminder",
    TrialMembersExpirationReminder = "TrialMembersExpirationReminder",

    OrderNotification = "OrderNotification",

    RegistrationConfirmation = "RegistrationConfirmation",
    RegistrationTransferDetails = "RegistrationTransferDetails",

    OrderConfirmationOnline = "OrderConfirmationOnline",
    OrderConfirmationTransfer = "OrderConfirmationTransfer",
    OrderConfirmationPOS = "OrderConfirmationPOS",
    OrderReceivedTransfer = "OrderReceivedTransfer",
    OrderOnlinePaymentFailed = "OrderOnlinePaymentFailed",

    /**
     * Tickets sent immediately after ordering
     */
    TicketsConfirmation = "TicketsConfirmation",

    /**
     * Order received, tickets will follow when we receive your payment
     */
    TicketsConfirmationTransfer = "TicketsConfirmationTransfer",

    /**
     * Order received, tickets sent, but need to get paid at entrance
     */
    TicketsConfirmationPOS = "TicketsConfirmationPOS",

    /**
     * Tickets sent after payment is received
     */
    TicketsReceivedTransfer = "TicketsReceivedTransfer",

    /**
     * Organization emails:
     */
    OrganizationUnstableDNS = "OrganizationUnstableDNS",
    OrganizationInvalidDNS = "OrganizationInvalidDNS",
    OrganizationValidDNS = "OrganizationValidDNS",
    OrganizationStableDNS = "OrganizationStableDNS",
    OrganizationDNSSetupComplete = "OrganizationDNSSetupComplete",

    // Drip emails
    OrganizationDripWelcome = "OrganizationDripWelcome",
    OrganizationDripWebshopTrialCheckin = "OrganizationDripWebshopTrialCheckin",
    OrganizationDripMembersTrialCheckin = "OrganizationDripMembersTrialCheckin",
    OrganizationDripWebshopTrialExpired = "OrganizationDripWebshopTrialExpired",
    OrganizationDripMembersTrialExpired = "OrganizationDripMembersTrialExpired",
    OrganizationDripTrialExpiredReminder = "OrganizationDripTrialExpiredReminder",
    OrganizationDripWebshopNotRenewed = "OrganizationDripWebshopNotRenewed",
    OrganizationDripMembersNotRenewed = "OrganizationDripMembersNotRenewed",
}

export class EmailTemplate extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null = null

    @field({ decoder: StringDecoder })
    subject = ""

    @field({ decoder: new EnumDecoder(EmailTemplateType) })
    type: EmailTemplateType = EmailTemplateType.SavedMembersEmail

    @field({ decoder: StringDecoder })
    html = ""

    @field({ decoder: StringDecoder })
    text = ""

    @field({ decoder: AnyDecoder })
    json = {}

    @field({ decoder: StringDecoder, nullable: true })
    groupId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    webshopId: string | null = null;

    @field({ decoder: DateDecoder, optional: true })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder, optional: true })
    updatedAt: Date = new Date();

    static getDefaultForRecipient(type: EmailRecipientFilterType): EmailTemplateType|null {
        if (type === EmailRecipientFilterType.Members || type === EmailRecipientFilterType.MemberParents) {
            return EmailTemplateType.DefaultMembersEmail
        }

        return null;
    }

    static isSavedEmail(type: EmailTemplateType): boolean {
        if (type === EmailTemplateType.SavedMembersEmail) {
            return true
        }

        return false;
    }

    static getRecipientType(type: EmailTemplateType): EmailRecipientFilterType|null {
        if (type === EmailTemplateType.SavedMembersEmail) {
            return EmailRecipientFilterType.Members
        }

        if (type === EmailTemplateType.DefaultMembersEmail) {
            return EmailRecipientFilterType.Members
        }

        // Use custom getSupportedReplacementsForType for this type
        return null;
    }

    static getTypeTitle(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.SavedMembersEmail: return 'Opgeslagen e-mail naar leden'
            case EmailTemplateType.DefaultMembersEmail: return 'Standaard e-mail naar leden'

            case EmailTemplateType.MembersExpirationReminder: return 'Herinnering verlopen pakket ledenadministratie'
            case EmailTemplateType.WebshopsExpirationReminder: return 'Herinnering verlopen pakket webshops'
            case EmailTemplateType.SingleWebshopExpirationReminder: return 'Herinnering verlopen pakket enkele webshop'
            case EmailTemplateType.TrialWebshopsExpirationReminder: return 'Herinnering verlopen proefperiode pakket webshops'
            case EmailTemplateType.TrialMembersExpirationReminder: return 'Herinnering verlopen proefperiode pakket ledenadministratie'
            case EmailTemplateType.OrderNotification: return 'Bestelling notificatie'

            case EmailTemplateType.RegistrationConfirmation: return 'Inschrijvingsbevestiging'
            case EmailTemplateType.RegistrationTransferDetails: return 'Betaalinstructies voor inschrijving met overschrijving'

            case EmailTemplateType.OrderConfirmationOnline: return 'Webshop: Bestelling bevestiging online betaling'
            case EmailTemplateType.OrderConfirmationTransfer: return 'Webshop: Bestelling bevestiging overschrijving'
            case EmailTemplateType.OrderConfirmationPOS: return 'Webshop: Bestelling bevestiging betaling aan de kassa'
            case EmailTemplateType.OrderReceivedTransfer: return 'Webshop: Bestelling ontvangen overschrijving'
            case EmailTemplateType.OrderOnlinePaymentFailed: return 'Webshop: Online betaling mislukt'
            case EmailTemplateType.TicketsConfirmation: return 'Webshop: Tickets bevestiging'
            case EmailTemplateType.TicketsConfirmationTransfer: return 'Webshop: Tickets bevestiging overschrijving'
            case EmailTemplateType.TicketsConfirmationPOS: return 'Webshop: Tickets bevestiging betaling aan de kassa'
            case EmailTemplateType.TicketsReceivedTransfer: return 'Webshop: Tickets ontvangen overschrijving'

            case EmailTemplateType.OrganizationUnstableDNS: return 'Organisatie: instabiele DNS'
            case EmailTemplateType.OrganizationInvalidDNS: return 'Organisatie: ongeldige DNS'
            case EmailTemplateType.OrganizationValidDNS: return 'Organisatie: geldige DNS'
            case EmailTemplateType.OrganizationStableDNS: return 'Organisatie: stabiele DNS'
            case EmailTemplateType.OrganizationDNSSetupComplete: return 'Organisatie: DNS setup compleet'

            case EmailTemplateType.OrganizationDripWelcome: return 'Organisatie: drip welkom'
            case EmailTemplateType.OrganizationDripWebshopTrialCheckin: return 'Organisatie: drip webshop proefperiode checkin'
            case EmailTemplateType.OrganizationDripMembersTrialCheckin: return 'Organisatie: drip ledenadministratie proefperiode checkin'
            case EmailTemplateType.OrganizationDripWebshopTrialExpired: return 'Organisatie: drip webshop proefperiode verlopen'
            case EmailTemplateType.OrganizationDripMembersTrialExpired: return 'Organisatie: drip ledenadministratie proefperiode verlopen'
            case EmailTemplateType.OrganizationDripTrialExpiredReminder: return 'Organisatie: drip proefperiode verlopen reminder'
            case EmailTemplateType.OrganizationDripWebshopNotRenewed: return 'Organisatie: drip webshop niet verlengd'
            case EmailTemplateType.OrganizationDripMembersNotRenewed: return 'Organisatie: drip ledenadministratie niet verlengd'
        }
    }

    static allowOrganizationLevel(type: EmailTemplateType): boolean {
        switch (type) {
            case EmailTemplateType.SavedMembersEmail: return true

            case EmailTemplateType.RegistrationConfirmation: return true
            case EmailTemplateType.RegistrationTransferDetails: return true

            case EmailTemplateType.OrderConfirmationOnline: return true
            case EmailTemplateType.OrderConfirmationTransfer: return true
            case EmailTemplateType.OrderConfirmationPOS: return true
            case EmailTemplateType.OrderReceivedTransfer: return true
            case EmailTemplateType.TicketsConfirmation: return true
            case EmailTemplateType.TicketsConfirmationTransfer: return true
            case EmailTemplateType.TicketsConfirmationPOS: return true
            case EmailTemplateType.TicketsReceivedTransfer: return true
        }

        return false
    }

    static getPlatformTypeDescription(type: EmailTemplateType): string|null {
        switch (type) {

            case EmailTemplateType.OrganizationUnstableDNS: return 'Organisatie: instabiele DNS'
            case EmailTemplateType.OrganizationInvalidDNS: return 'Organisatie: ongeldige DNS'
            case EmailTemplateType.OrganizationValidDNS: return 'Organisatie: geldige DNS'
            case EmailTemplateType.OrganizationStableDNS: return 'Organisatie: stabiele DNS'
            case EmailTemplateType.OrganizationDNSSetupComplete: return 'Organisatie: DNS setup compleet'

            case EmailTemplateType.OrderOnlinePaymentFailed: return 'Wanneer een online betaling bij een webshop mislukt na een lange tijd wachten - zou zelden mogen voorkomen'
        }

        return null
    }


    static getTypeDescription(type: EmailTemplateType): string {
        switch (type) {
            case EmailTemplateType.DefaultMembersEmail: return 'Als iemand een nieuwe e-mail opstelt, gericht aan leden, zal deze template standaard al klaar staan. Deze kan dan nog aangepast worden.'

            case EmailTemplateType.OrderNotification: return 'E-mail die webshop eigenaren ontvangen wanneer er een bestelling is geplaatst (indien ze die functie hebben ingeschakeld)'
            case EmailTemplateType.RegistrationConfirmation: return 'Na het inschrijven ontvangen de leden deze e-mail'

            case EmailTemplateType.OrderConfirmationOnline: return 'Wanneer een besteller online betaald (of totaalbedrag is 0 euro)'
            case EmailTemplateType.OrderConfirmationTransfer: return 'Wanneer een besteller kiest voor overschrijving - bevat nog eens de betaalinstructies als de betaling nog niet zou zijn gebeurd'
            case EmailTemplateType.OrderConfirmationPOS: return 'Wanneer een besteller kiest voor betaling ter plaatse/bij levering'
            case EmailTemplateType.OrderReceivedTransfer: return 'De e-mail die een besteller nog ontvangt als je de betaling hebt gemarkeerd als ontvangen (enkel bij betaalmethode overschrijving)'
            
            case EmailTemplateType.TicketsConfirmation: return 'Wanneer een besteller online betaald (of totaalbedrag is 0 euro)'
            case EmailTemplateType.TicketsConfirmationTransfer: return 'Wanneer een besteller kiest voor overschrijving - bevat nog eens de betaalinstructies als de betaling nog niet zou zijn gebeurd'
            case EmailTemplateType.TicketsConfirmationPOS: return 'Wanneer een besteller kiest voor betaling ter plaatse/bij levering'
            case EmailTemplateType.TicketsReceivedTransfer: return 'De e-mail die een besteller nog ontvangt als je de betaling hebt gemarkeerd als ontvangen (enkel bij betaalmethode overschrijving)'

        }

        return ''
    }

    static getSupportedReplacementsForType(type: EmailTemplateType): string[] {
        if (type === EmailTemplateType.RegistrationConfirmation) {
            return [
                "firstName",
                "lastName",
                "email",
                "registerUrl",
                "organizationName",
                "groupName",
                "signInUrl",
                "unsubscribeUrl",
                'loginDetails'
            ];
        }

        if ([
            EmailTemplateType.OrganizationDNSSetupComplete, 
            EmailTemplateType.OrganizationInvalidDNS,
            EmailTemplateType.OrganizationStableDNS,
            EmailTemplateType.OrganizationUnstableDNS,
            EmailTemplateType.OrganizationValidDNS
        ].includes(type)) {
            return [
                "firstName",
                "lastName",
                "email",
                "organizationName",
                "mailDomain"
            ];
        }

        if (type === EmailTemplateType.RegistrationTransferDetails) {
            return [
                "priceToPay",
                "paymentMethod",
                "transferDescription",
                "transferBankAccount",
                "transferBankCreditor",
                "overviewContext",
                "memberNames",
                "overviewTable",
                "paymentTable",
                "registerUrl",
                "organizationName",
                "signInUrl",
                "unsubscribeUrl",
                'loginDetails'
            ];
        }

        if ([
            EmailTemplateType.MembersExpirationReminder, 
            EmailTemplateType.WebshopsExpirationReminder, 
            EmailTemplateType.TrialMembersExpirationReminder, 
            EmailTemplateType.TrialWebshopsExpirationReminder, 
            EmailTemplateType.SingleWebshopExpirationReminder
        ].includes(type)) {
            return [
                "firstName",
                "organizationName",
                "packageName",
                "validUntil",
                "validUntilDate",
                "renewUrl",
                "unsubscribeUrl"
            ]
        }
        const sharedReplacements = [
            "orderPrice",
            "orderStatus",
            "orderDetailsTable",
            "orderTable",
            "paymentTable",
            "orderUrl",
            "paymentMethod",
            "organizationName",
            "webshopName",
            "unsubscribeUrl"
        ]

        if (type !== EmailTemplateType.OrderOnlinePaymentFailed) {
            sharedReplacements.push(
                "nr"
            )
        }

        if (type !== EmailTemplateType.OrderNotification) {
            sharedReplacements.push(
                "firstName",
                "lastName"
            )
        }

        if (type === EmailTemplateType.OrderConfirmationTransfer || type === EmailTemplateType.TicketsConfirmationTransfer) {
            return [
                ...sharedReplacements,
                "transferDescription",
                "transferBankAccount",
                "transferBankCreditor"
            ];
        }

        return sharedReplacements
    }
}
