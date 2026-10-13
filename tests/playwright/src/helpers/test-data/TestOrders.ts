import { Database } from '@simonbackx/simple-database';
import type { Order, Webshop } from '@stamhoofd/models';
import { BalanceItem, OrderFactory, Ticket, TicketFactory } from '@stamhoofd/models';
import { BalanceItemType, Cart, CartItem, CartItemPrice, Customer, OrderData, OrderStatus, PaymentMethod, Product, ProductPrice } from '@stamhoofd/structures';

export interface TestOrderSeed {
    number: number;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    status?: OrderStatus;
    paymentMethod?: PaymentMethod;
    /** Price of the order (€ 1 = 1_0000), as one cart item of `amount` pieces. */
    price?: number;
    amount?: number;
    /** Also used as the date the order became valid ('Besteldatum' in the dashboard). */
    createdAt?: Date;
    /**
     * Adds a balance item for the price of the order, with this part already paid, like an order
     * of the checkout. Without one, the backend cannot calculate what is left to pay.
     */
    paid?: number;
    /** One entry per ticket: whether (and when) it is scanned. */
    tickets?: { scannedAt?: Date | null }[];
}

export interface TestOrder {
    seed: TestOrderSeed;
    order: Order;
    tickets: Ticket[];
    /** The name the dashboard shows (Customer.name). */
    name: string;
}

export class TestOrders {
    /**
     * Creates the orders one by one (in the given order), with their tickets.
     */
    static async create(webshop: Webshop, seeds: TestOrderSeed[]): Promise<TestOrder[]> {
        const result: TestOrder[] = [];
        for (const seed of seeds) {
            result.push(await this.createOne(webshop, seed));
        }
        return result;
    }

    static async createOne(webshop: Webshop, seed: TestOrderSeed): Promise<TestOrder> {
        const amount = seed.amount ?? 1;
        const customer = Customer.create({
            firstName: seed.firstName,
            lastName: seed.lastName,
            email: seed.email ?? `order-${seed.number}@example.com`,
            phone: seed.phone ?? '',
        });

        const order = await new OrderFactory({
            webshop,
            number: seed.number,
            status: seed.status ?? OrderStatus.Created,
            data: OrderData.create({
                customer,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product: Product.create({ id: 'product-test' }),
                            productPrice: ProductPrice.create({ id: 'price-test' }),
                            amount,
                            calculatedPrices: [CartItemPrice.create({ price: seed.price ?? 0 })],
                        }),
                    ],
                }),
                paymentMethod: seed.paymentMethod ?? PaymentMethod.Unknown,
            }),
        }).create();

        if (seed.createdAt) {
            const createdAt = new Date(seed.createdAt);
            createdAt.setMilliseconds(0);
            await Database.update('UPDATE `webshop_orders` SET `createdAt` = ?, `validAt` = ? WHERE `id` = ?', [createdAt, createdAt, order.id]);
            order.createdAt = createdAt;
            order.validAt = createdAt;
        }

        if (seed.paid !== undefined) {
            const balanceItem = new BalanceItem();
            balanceItem.organizationId = order.organizationId;
            balanceItem.orderId = order.id;
            balanceItem.type = BalanceItemType.Order;
            balanceItem.amount = 1;
            balanceItem.unitPrice = seed.price ?? 0;
            balanceItem.pricePaid = seed.paid;
            await balanceItem.save();
        }

        const tickets = await this.addTickets(order, seed.tickets ?? []);

        return { seed, order, tickets, name: customer.name };
    }

    /**
     * Adds tickets to an order, after the tickets it already has.
     */
    static async addTickets(order: Order, seeds: { scannedAt?: Date | null }[]): Promise<Ticket[]> {
        const existing = await Ticket.where({ orderId: order.id });
        const total = existing.length + seeds.length;
        const tickets: Ticket[] = [];
        for (const [index, seed] of seeds.entries()) {
            const ticket = await new TicketFactory({ order, index: existing.length + index + 1, total }).create();
            if (seed.scannedAt) {
                ticket.scannedAt = seed.scannedAt;
                ticket.scannedBy = 'Test';
                await ticket.save();
            }
            tickets.push(ticket);
        }
        return tickets;
    }
}
