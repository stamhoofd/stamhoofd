import { AutoEncoder, DateDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

export class Ticket extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: DateDecoder })
    scannedAt: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date | null = null;

    @field({ decoder: DateDecoder })
    updatedAt: Date | null = null;

    // todo: add code here (for inside the QR-code + text underneath)
}

export class TicketPrivate extends Ticket {
    /**
     * The orderId is private for every ticket because it provides access to the order
     */
    @field({ decoder: StringDecoder })
    orderId: string;

    /**
     * itemId is private because access to the order is needed to be able to look it up.
     */
    @field({ decoder: StringDecoder, nullable: true })
    itemId: string | null = null;

    /**
     * Private information
     */
    @field({ decoder: StringDecoder, nullable: true })
    scannedBy: string | null = null;
}