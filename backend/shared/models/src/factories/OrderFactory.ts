import { Database, Factory } from '@simonbackx/simple-database';
import { Cart, Customer, OrderData, OrderStatus } from '@stamhoofd/structures';

import { WebshopCounter } from '../helpers/WebshopCounter.js';
import { Order } from '../models/index.js';
import type { Webshop } from '../models/index.js';

class Options {
    /** The webshop the order belongs to (provides the organization and numbering). */
    webshop: Webshop;
    firstName?: string;
    lastName?: string;
    email?: string;
    /** Order number. Defaults to the next sequential number of the webshop. */
    number?: number;
    status?: OrderStatus;
    /**
     * Force a specific updatedAt. Stored with a one-second resolution (like the model itself), so
     * milliseconds are zeroed. Applied with a raw update because the model always overwrites
     * updatedAt on save.
     */
    updatedAt?: Date;
    /** Full OrderData override. Takes precedence over the firstName/lastName/email options. */
    data?: OrderData;
}

export class OrderFactory extends Factory<Options, Order> {
    async create(): Promise<Order> {
        const webshop = this.options.webshop;

        const data = this.options.data ?? OrderData.create({
            customer: Customer.create({
                firstName: this.options.firstName ?? 'John',
                lastName: this.options.lastName ?? 'Doe',
                email: this.options.email ?? 'john.doe@example.com',
            }),
            cart: Cart.create({}),
        });

        const order = new Order();
        order.organizationId = webshop.organizationId;
        order.webshopId = webshop.id;
        order.data = data;
        order.number = this.options.number ?? await WebshopCounter.getNextNumber(webshop);
        order.status = this.options.status ?? OrderStatus.Created;
        order.validAt = new Date();
        await order.save();

        if (this.options.updatedAt) {
            const forced = new Date(this.options.updatedAt);
            forced.setMilliseconds(0);
            await Database.update('UPDATE `webshop_orders` SET `updatedAt` = ? WHERE `id` = ?', [forced, order.id]);
            order.updatedAt = forced;
        }

        return order;
    }
}
