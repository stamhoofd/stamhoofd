import { ArrayDecoder, AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Sorter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { CartReservedSeat } from '../SeatingPlan.js';
import { CartItem } from './CartItem.js';
import { Order } from './Order.js';
import { Webshop, WebshopPreview } from './Webshop.js';

export class Ticket extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: DateDecoder, nullable: true })
    scannedAt: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();

    /**
     * Unique secret (per webshop) that is printed on the ticket and is required for lookups
     * + inside QR-code
     */
    @field({ decoder: StringDecoder })
    secret: string;

    @field({ decoder: IntegerDecoder })
    index: number;

    @field({ decoder: IntegerDecoder })
    total: number;

    @field({ decoder: CartReservedSeat, nullable: true, version: 216 })
    seat: CartReservedSeat | null = null;

    @field({ decoder: CartReservedSeat, nullable: true, version: 216 })
    originalSeat: CartReservedSeat | null = null;
}

/**
 * Ticket extended with the order data. This is
 * required because the user doesn't have access
 * to the order. So we need to add the relevant data
 * */
export class TicketPublic extends Ticket {
    @field({ decoder: new ArrayDecoder(CartItem) })
    items: CartItem[] = [];

    get isSingle() {
        return this.items.length === 1 && this.items[0].product.isTicket;
    }

    getPrice(order?: Order | null) {
        if (!this.isSingle) {
            if (order) {
                return order.data.totalPrice;
            }
            return Math.max(0, this.items.reduce((c, item) => c + (item.price ?? 0), 0));
        }

        const item = this.items[0];
        return (item.unitPrice ?? 0) + (this.seat?.price ?? 0);
    }

    getTitle() {
        if (!this.isSingle) {
            return $t(`de971042-551d-43d2-ab47-e76132156887`);
        }
        return this.items[0].product.name;
    }

    getChangedSeatString(webshop: Webshop | WebshopPreview, isCustomer: boolean) {
        if (!this.isSingle) {
            return null;
        }
        const item = this.items[0];
        if (!item || !item.product.seatingPlanId) {
            return null;
        }
        if (!this.originalSeat) {
            return null;
        }
        if (!this.seat) {
            return null;
        }
        if (this.seat.equals(this.originalSeat)) {
            return null;
        }

        const to = this.seat.getNameString(webshop, item.product);
        const from = this.originalSeat.getNameString(webshop, item.product);

        if (isCustomer) {
            return $t(`bfbfa403-7d12-4cbd-b299-2dd3a8b32ad1`, { from, to });
        }
        return $t(`6d281e06-4827-4b95-9434-9e3d5d96215a`, { from, to });
    }

    getIndexDescriptionString(webshop: Webshop | WebshopPreview) {
        if (!this.isSingle) {
            return '';
        }
        const description = this.getIndexDescription(webshop);
        return description.map(d => d.title + ': ' + d.value).join('\n');
    }

    getIndexDescription(webshop: Webshop | WebshopPreview): { title: string; value: string }[] {
        if (!this.isSingle) {
            return [];
        }
        const item = this.items[0];
        if (!item || !item.product.seatingPlanId) {
            return [];
        }

        const seat = this.seat;
        if (seat) {
            const r = seat.getName(webshop, item.product);
            if (r.length > 0) {
                return r;
            }
        }
        return [
            {
                title: $t(`8435edb8-619e-4ddf-b5c8-4d1a2bc44acc`),
                value: $t(`896f4cd8-ee2e-4ff6-a174-a1c8078b6a52`),
            },
        ];
    }

    getSeatingPlanId() {
        if (!this.isSingle) {
            return null;
        }
        return this.items[0].product.seatingPlanId;
    }

    getIndexText(): string | null {
        if (this.items.length !== 1) {
            if (this.total > 1) {
                return this.index + ' / ' + this.total;
            }
            return null;
        }

        const item = this.items[0];
        const nameField = item.fieldAnswers.findIndex(a => a.field.name.toLowerCase().includes('naam'));
        if (nameField !== -1) {
            return item.fieldAnswers[nameField].answer;
        }

        if (this.total > 1) {
            return this.index + ' / ' + this.total;
        }
        return null;
    }

    static sort(a: TicketPublic, b: TicketPublic) {
        return Sorter.stack(
            Sorter.byNumberValue(a.items.length, b.items.length),
            Sorter.byStringValue(a.items[0]?.product?.name ?? '', b.items[0]?.product?.name ?? ''),
            Sorter.byStringValue(a.items[0]?.id ?? '', b.items[0]?.id ?? ''), // group same options and items
            -1 * Sorter.byNumberValue(a.index, b.index),
        );
    }

    get isValid() {
        return this.items.length > 0;
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
            const item = order.data.cart.items.find(i => i.id === this.itemId);
            return TicketPublic.create({
                ...this,
                items: item ? [item] : [],
            });
        }
        else {
            return TicketPublic.create({
                ...this,
                items: order.data.cart.items,
            });
        }
    }
}

export class TicketPublicPrivate extends TicketPublic {
    /**
     * Private information
     */
    @field({ decoder: StringDecoder, nullable: true })
    scannedBy: string | null = null;

    @field({ decoder: DateDecoder, nullable: true, version: 229 })
    deletedAt: Date | null = null;

    getPublic(): TicketPublicPrivate {
        return this;
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

    @field({ decoder: DateDecoder, nullable: true, version: 229 })
    deletedAt: Date | null = null;

    getPublic(order: Order): TicketPublicPrivate {
        return TicketPublicPrivate.create({
            ...super.getPublic(order),
            scannedBy: this.scannedBy,
            deletedAt: this.deletedAt,
        });
    }
}
