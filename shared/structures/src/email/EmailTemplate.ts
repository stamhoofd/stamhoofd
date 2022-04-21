import { AnyDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

export enum EmailTemplateType {
    /**
     * Template created by the user to send manually
     */
    UserGenerated = "UserGenerated",
    PackageExpirationReminder = "PackageExpirationReminder",

    RegistrationConfirmation = "RegistrationConfirmation",

    OrderConfirmationOnline = "OrderConfirmationOnline",
    OrderConfirmationTransfer = "OrderConfirmationTransfer",
    OrderConfirmationPOS = "OrderConfirmationPOS",
    OrderReceivedTransfer = "OrderReceivedTransfer",

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

        if (type === EmailTemplateType.PackageExpirationReminder) {
            return [
                "firstName",
                "organizationName",
                "packageName",
                "validUntil",
            ]
        }
        const sharedReplacements = [
            "firstName",
            "lastName",
            "nr",
            "orderPrice",
            "orderStatus",
            "orderDetailsTable",
            "orderTable",
            "paymentTable",
            "orderUrl",
            "paymentMethod",
            "organizationName",
            "webshopName"
        ]

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