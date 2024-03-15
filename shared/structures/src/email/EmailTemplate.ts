import { AnyDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

export enum EmailTemplateType {
    /**
     * Template created by the user to send manually
     */
    UserGenerated = "UserGenerated",
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
    OrganizationDNSSetupComplete = "OrganizationDNSSetupComplete"
}

export class EmailTemplate extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null = null

    @field({ decoder: StringDecoder })
    subject = ""

    @field({ decoder: new EnumDecoder(EmailTemplateType) })
    type: EmailTemplateType = EmailTemplateType.UserGenerated

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