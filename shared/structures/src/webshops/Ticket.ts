import { ArrayDecoder, AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { Sorter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { CartItem } from "./Cart";
import { Order } from "./Order";

export class Ticket extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: DateDecoder, nullable: true })
    scannedAt: Date | null = null;

    @field({ decoder: DateDecoder})
    createdAt: Date

    @field({ decoder: DateDecoder })
    updatedAt: Date

    /**
     * Unique secret (per webshop) that is printed on the ticket and is required for lookups
     * + inside QR-code
     */
    @field({ decoder: StringDecoder })
    secret: string;

    @field({ decoder: IntegerDecoder })
    index: number

    @field({ decoder: IntegerDecoder })
    total: number
}

/** 
 * Ticket extended with the order data. This is
 * required because the user doesn't have access
 * to the order. So we need to add the relevant data
 * */
export class TicketPublic extends Ticket {
    @field({ decoder: new ArrayDecoder(CartItem) })
    items: CartItem[] = []

    getTitle() {
        if (this.items.length != 1) {
            return "Ticket"
        }
        return this.items[0].product.name
    }

    getIndexText(): string | null {
        if (this.items.length != 1) {
            if (this.total > 1) {
                return this.index+" / "+this.total
            }
            return null
        }

        const item = this.items[0]
        const nameField = item.fieldAnswers.findIndex(a => a.field.name.toLowerCase().includes("naam"))
        if (nameField !== -1) {
            return item.fieldAnswers[nameField].answer
        }

        if (this.total > 1) {
            return this.index+" / "+this.total
        }
        return null
    }

    static sort(a: TicketPublic, b: TicketPublic) {
        return Sorter.stack(
            Sorter.byNumberValue(a.items.length, b.items.length),
            Sorter.byStringValue(a.items[0]?.product?.name ?? "", b.items[0]?.product?.name ?? ""),
            Sorter.byStringValue(a.items[0]?.id ?? "", b.items[0]?.id ?? ""), // group same options and items
            -1 * Sorter.byNumberValue(a.index, b.index) as any,
        )
    }
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