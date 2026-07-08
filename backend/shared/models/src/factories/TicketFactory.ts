import { Database, Factory } from '@simonbackx/simple-database';

import { Ticket } from '../models/index.js';
import type { Order } from '../models/index.js';

class Options {
    /** The order the ticket belongs to (provides the organization, webshop and order id). */
    order: Order;
    index?: number;
    total?: number;
    /**
     * Force a specific updatedAt. Stored with a one-second resolution (like the model itself), so
     * milliseconds are zeroed. Applied with a raw update because the model always overwrites
     * updatedAt on save.
     */
    updatedAt?: Date;
}

export class TicketFactory extends Factory<Options, Ticket> {
    async create(): Promise<Ticket> {
        const order = this.options.order;

        const ticket = new Ticket();
        ticket.organizationId = order.organizationId;
        ticket.webshopId = order.webshopId;
        ticket.orderId = order.id;
        ticket.itemId = null;
        ticket.index = this.options.index ?? 1;
        ticket.total = this.options.total ?? 1;
        await ticket.save();

        if (this.options.updatedAt) {
            const forced = new Date(this.options.updatedAt);
            forced.setMilliseconds(0);
            await Database.update('UPDATE `webshop_tickets` SET `updatedAt` = ? WHERE `id` = ?', [forced, ticket.id]);
            ticket.updatedAt = forced;
        }

        return ticket;
    }
}
