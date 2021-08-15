import { ArrayDecoder, AutoEncoder, DateDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

import { CartItem } from "./Cart";
import { Order } from "./Order";

export class Ticket extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: DateDecoder, nullable: true })
    scannedAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    updatedAt: Date | null = null;

    /**
     * Unique secret (per webshop) that is printed on the ticket and is required for lookups
     * + inside QR-code
     */
    @field({ decoder: StringDecoder })
    secret: string;
}

/** 
 * Ticket extended with the order data. This is
 * required because the user doesn't have access
 * to the order. So we need to add the relevant data
 * */
export class TicketPublic extends Ticket {
    @field({ decoder: new ArrayDecoder(CartItem) })
    items: CartItem[] = []
}

/**
 * Structure if you do have access to the order (needs proof first: be an admin or pass the order id along the request)
 */
export class TicketOrder extends Ticket {
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

    getPublic(order: Order): TicketPublic {
        if (this.itemId) {
            const item = order.data.cart.items.find(i => i.id === this.itemId)
            return TicketPublic.create({
                ...this,
                items: item ? [item] : []
            })
        } else {
            return TicketPublic.create({
                ...this,
                items: order.data.cart.items
            })
        }
    }
}

/**
 * Structure if you do have access to the order (needs proof first: be an admin or pass the order id along the request)
 */
export class TicketPrivate extends TicketOrder {
    /**
     * Private information
     */
    @field({ decoder: StringDecoder, nullable: true })
    scannedBy: string | null = null;
}