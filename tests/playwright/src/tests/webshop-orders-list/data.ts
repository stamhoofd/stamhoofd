import { PaymentMethod } from '@stamhoofd/structures/PaymentMethod.js';
import { OrderStatus } from '@stamhoofd/structures/webshops/Order.js';
import type { TestOrderSeed } from '../../helpers/index.js';

// Lengths without common factors, so every combination of name, status, payment method and tickets occurs
const firstNames = ['Anna', 'bert', 'Céline', 'DIRK', 'eva', 'Frank', 'Émile', 'Zoë', 'anna-lies', 'Bart', 'Gert'];
const statuses = [OrderStatus.Created, OrderStatus.Prepared, OrderStatus.Collect, OrderStatus.Completed, OrderStatus.Canceled];
const paymentMethods = [PaymentMethod.PointOfSale, PaymentMethod.Transfer, PaymentMethod.Bancontact];

/**
 * A mix of orders where every property used by the filters and sorting varies independently: names with
 * different casing and accents, all statuses and payment methods, prices that are not in the order of the
 * numbers, orders created in the same second, and orders without, with some, and with all tickets scanned.
 */
export function mixedOrderSeeds(count: number, options: { withTickets?: boolean } = {}): TestOrderSeed[] {
    const createdAt = new Date('2026-03-01T10:00:00Z');

    return Array.from({ length: count }, (_, i) => {
        const number = i + 1;
        const ticketCount = options.withTickets ? number % 4 : 0;
        // All, none or one of the tickets scanned
        const scannedCount = [ticketCount, ticketCount, 0, 0, 0, 1, 1][number % 7];

        return {
            number,
            firstName: firstNames[number % firstNames.length],
            lastName: `Klant ${number}`,
            email: `klant.${number}@Example.com`,
            status: statuses[number % statuses.length],
            paymentMethod: paymentMethods[number % paymentMethods.length],
            price: (number * 7_919) % 50_000,
            amount: (number % 4) + 1,
            createdAt: new Date(createdAt.getTime() + (number % 7) * 60_000),
            tickets: Array.from({ length: ticketCount }, (_, t) => ({
                scannedAt: t < scannedCount ? new Date(createdAt.getTime() + number * 1_000) : null,
            })),
        };
    });
}

const scannedAt = new Date('2026-03-01T12:00:00Z');

/**
 * Orders whose names, e-mail addresses and phone numbers are compared differently by the browser (the local
 * order database of the dashboard) and by MySQL (the backend), plus order numbers, prices and amounts that sort
 * differently as text than as numbers. Every order has a balance item, like an order of the checkout.
 */
export function edgeCaseOrderSeeds(): TestOrderSeed[] {
    return [
        { number: 1, firstName: 'José', lastName: 'Müller', email: 'jose.muller@example.com', status: OrderStatus.Created, price: 5_0000, paid: 0, tickets: [{ scannedAt }] },
        { number: 2, firstName: 'Jose', lastName: 'Muller', email: 'JOSE.MULLER@EXAMPLE.COM', status: OrderStatus.Prepared, price: 12_5000, paid: 12_5000, tickets: [{ scannedAt }, {}] },
        { number: 3, firstName: 'Anna', lastName: 'Strauß', email: 'anna@example.com', status: OrderStatus.Collect, price: 1_0000, paid: 1_0000, tickets: [{}] },
        { number: 4, firstName: 'Solo', lastName: '', email: 'solo@example.com', status: OrderStatus.Completed, price: 0, paid: 0 },
        { number: 5, firstName: '', lastName: 'Alleen', email: 'alleen@example.com', status: OrderStatus.Canceled, price: 20_0000, paid: 0 },
        { number: 6, firstName: 'Jean-Claude', lastName: 'Van  Damme', email: 'jcvd@example.com', status: OrderStatus.Created, price: 9_9900, paid: 5_0000 },
        { number: 7, firstName: '100%', lastName: 'Zeker_', email: 'zeker@example.com', status: OrderStatus.Created, price: 3_0000, paid: 0 },
        { number: 8, firstName: 'Seán', lastName: 'O\'Brien', email: 'sean@example.com', status: OrderStatus.Prepared, price: 4_0000, paid: 4_0000 },
        { number: 9, firstName: 'Øystein', lastName: 'Ørsted', email: 'oystein@example.com', status: OrderStatus.Created, price: 6_0000, paid: 0 },
        { number: 10, firstName: 'Sofie', lastName: 'Peeters', email: 'Sofie.Peeters@Example.com', phone: '+32 478 12 34 56', status: OrderStatus.Completed, price: 7_0000, paid: 7_0000 },
        { number: 11, firstName: 'Lies', lastName: 'Vaste Lijn', email: 'lies@example.com', phone: '+32 412 34 56 78', status: OrderStatus.Created, price: 8_0000, paid: 0 },
        { number: 20, firstName: 'Klant', lastName: 'Twintig', email: 'twintig@example.com', status: OrderStatus.Created, price: 2_0000, amount: 2, paid: 0, tickets: [{ scannedAt }, { scannedAt }, { scannedAt }] },
        { number: 100, firstName: 'Klant', lastName: 'Honderd', email: 'honderd@example.com', status: OrderStatus.Prepared, price: 100_0000, amount: 10, paid: 0 },
        { number: 1000, firstName: 'Klant', lastName: 'Duizend', email: 'duizend@example.com', status: OrderStatus.Collect, price: 1000_0000, amount: 100, paid: 0 },
    ];
}
