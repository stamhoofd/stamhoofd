import { setup, test } from '../../test-fixtures/base.js';

setup();

import { expect } from '@playwright/test';
import type { StamhoofdFilter } from '@stamhoofd/structures/filters/StamhoofdFilter.js';
import { OrderStatus } from '@stamhoofd/structures/webshops/Order.js';
import { WebshopTicketType } from '@stamhoofd/structures/webshops/WebshopMetaData.js';
import { TestUtils } from '@stamhoofd/test-utils';
import type { TestOrder } from '../../helpers/index.js';
import { TestOrders } from '../../helpers/index.js';
import type { NumberFilterMode, OrdersTable, StringFilterMode } from '../../helpers/page/webshop/OrdersTable.js';
import { edgeCaseOrderSeeds } from './data.js';
import { expectOrders, names, sortOrders, ticketScanStatus } from './expected.js';
import type { OrdersListWebshop } from './setup.js';
import { createOrdersListWebshop, openOrdersList } from './setup.js';

/**
 * Every filter and search of the orders table on orders that MySQL and the browser compare differently: the
 * table must show the same orders as the backend endpoints (used by e-mails and Mailchimp) for the same filter.
 */
test.describe('Orders list filters @webshop-orders-list @extra', () => {
    test.describe.configure({ timeout: 2 * 60_000 });

    let shop: OrdersListWebshop;
    let orders: TestOrder[];

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        shop = await createOrdersListWebshop('OrdersFilters', { ticketType: WebshopTicketType.Tickets });
        orders = await TestOrders.create(shop.webshop, edgeCaseOrderSeeds());
    });

    const withNumbers = (...numbers: number[]) => numbers.map(n => orders.find(o => o.seed.number === n)!);

    /**
     * Opens the table, lets `apply` set the filters and search, and checks the result against the expected orders and the backend.
     */
    async function check(browser: import('@playwright/test').Browser, options: { apply: (table: OrdersTable) => Promise<void>; expected: () => TestOrder[]; search?: string; backendFilter?: StamhoofdFilter | null }) {
        const { context, table, backend } = await openOrdersList(browser, shop);
        await table.expectCount(orders.length);
        await options.apply(table);
        if (options.search) {
            await table.search(options.search);
        }
        await expectOrders({ table, backend, webshopId: shop.webshop.id, all: orders, expected: options.expected(), filtered: true, search: options.search, backendFilter: options.backendFilter });
        await context.close();
    }

    test.describe('Choice filters', () => {
        test('Status', async ({ browser }) => {
            await check(browser, {
                apply: table => table.addChoiceFilter('Status', ['Nieuw', 'Ligt klaar']),
                expected: () => orders.filter(o => o.seed.status === OrderStatus.Created || o.seed.status === OrderStatus.Collect),
                backendFilter: { status: { $in: [OrderStatus.Created, OrderStatus.Collect] } },
            });
        });

        test('Payment status: still to pay', async ({ browser }) => {
            await check(browser, {
                apply: table => table.addChoiceFilter('Betaalstatus', ['Nog te betalen']),
                expected: () => orders.filter(o => o.seed.status !== OrderStatus.Canceled && (o.seed.price ?? 0) > (o.seed.paid ?? 0)),
                backendFilter: { status: { $not: { $in: [OrderStatus.Canceled, OrderStatus.Deleted] } }, amountToPay: { $gt: 0 } },
            });
        });

        test('Payment status: paid', async ({ browser }) => {
            await check(browser, {
                apply: table => table.addChoiceFilter('Betaalstatus', ['Betaald (of niet meer te betalen)']),
                expected: () => orders.filter(o => o.seed.status === OrderStatus.Canceled || (o.seed.price ?? 0) <= (o.seed.paid ?? 0)),
                backendFilter: { $or: [{ status: { $in: [OrderStatus.Canceled, OrderStatus.Deleted] } }, { amountToPay: { $lte: 0 } }] },
            });
        });
    });

    test.describe('Number filters compare numbers, not text', () => {
        const cases: { filter: string; mode: NumberFilterMode; value: number; key: string; operator: string; backendValue: number; matches: (o: TestOrder) => boolean }[] = [
            { filter: '#', mode: 'Groter dan...', value: 9, key: 'number', operator: '$gt', backendValue: 9, matches: o => o.seed.number > 9 },
            { filter: '#', mode: 'Kleiner dan of gelijk aan...', value: 100, key: 'number', operator: '$lte', backendValue: 100, matches: o => o.seed.number <= 100 },
            { filter: 'Bedrag', mode: 'Kleiner dan...', value: 10, key: 'totalPrice', operator: '$lt', backendValue: 10_0000, matches: o => (o.seed.price ?? 0) < 10_0000 },
            { filter: 'Bedrag', mode: 'Groter dan of gelijk aan...', value: 100, key: 'totalPrice', operator: '$gte', backendValue: 100_0000, matches: o => (o.seed.price ?? 0) >= 100_0000 },
            { filter: 'Aantal', mode: 'Gelijk aan...', value: 10, key: 'amount', operator: '$eq', backendValue: 10, matches: o => (o.seed.amount ?? 1) === 10 },
            { filter: 'Aantal', mode: 'Groter dan...', value: 2, key: 'amount', operator: '$gt', backendValue: 2, matches: o => (o.seed.amount ?? 1) > 2 },
        ];

        for (const c of cases) {
            test(`${c.filter} ${c.mode} ${c.value}`, async ({ browser }) => {
                await check(browser, {
                    apply: table => table.addNumberFilter(c.filter, c.mode, c.value),
                    expected: () => orders.filter(c.matches),
                    backendFilter: { [c.key]: { [c.operator]: c.backendValue } },
                });
            });
        }
    });

    test.describe('Text filters', () => {
        const cases: { filter: string; key: string; mode: StringFilterMode; value: string; expected: number[] }[] = [
            // Casing and accents
            { filter: 'Naam', key: 'name', mode: 'Bevat...', value: 'MÜLLER', expected: [1, 2] },
            { filter: 'Naam', key: 'name', mode: 'Bevat...', value: 'muller', expected: [1, 2] },
            // Characters with a meaning in SQL LIKE
            { filter: 'Naam', key: 'name', mode: 'Bevat...', value: '%', expected: [7] },
            { filter: 'Naam', key: 'name', mode: 'Bevat...', value: '_', expected: [7] },
            { filter: 'Naam', key: 'name', mode: 'Bevat...', value: 'o\'brien', expected: [8] },
            // Negations
            { filter: 'Naam', key: 'name', mode: 'Bevat niet...', value: 'klant', expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
            // E-mail addresses are stored with any casing
            { filter: 'E-mailadres', key: 'email', mode: 'Is gelijk aan...', value: 'jose.muller@example.com', expected: [1, 2] },
            { filter: 'E-mailadres', key: 'email', mode: 'Bevat...', value: 'PEETERS@EXAMPLE', expected: [10] },
        ];

        for (const c of cases) {
            test(`${c.filter} ${c.mode} '${c.value}'`, async ({ browser }) => {
                const operator = { 'Bevat...': '$contains', 'Is gelijk aan...': '$eq', 'Bevat niet...': '$contains', 'Is niet gelijk aan...': '$eq', 'Is leeg': '$eq', 'Is niet leeg': '$eq' }[c.mode];
                const filter = { [c.key]: { [operator]: c.value } };
                await check(browser, {
                    apply: table => table.addStringFilter(c.filter, c.mode, c.value),
                    expected: () => withNumbers(...c.expected),
                    backendFilter: c.mode.includes('niet') ? { $not: filter } : filter,
                });
            });
        }
    });

    test.describe('Search', () => {
        const cases: { search: string; expected: number[] }[] = [
            // A name, in another casing and without accents
            { search: 'MÜLLER', expected: [1, 2] },
            { search: 'jose muller', expected: [1, 2] },
            // Characters with a meaning in SQL LIKE
            { search: 'o\'brien', expected: [8] },
            // A complete e-mail address is looked up exactly, part of one with a contains
            { search: 'JOSE.MULLER@example.com', expected: [1, 2] },
            { search: 'peeters@', expected: [10] },
            // Phone numbers, in another notation than they are stored
            { search: '0478 12 34 56', expected: [10] },
            { search: '0478123456', expected: [10] },
            // An order number
            { search: '20', expected: [20] },
            { search: '1000', expected: [1000] },
        ];

        for (const c of cases) {
            test(`'${c.search}'`, async ({ browser }) => {
                await check(browser, {
                    apply: async () => {},
                    search: c.search,
                    expected: () => withNumbers(...c.expected),
                    backendFilter: null,
                });
            });
        }
    });

    test.describe('Ticket filters (only in the dashboard)', () => {
        for (const [option, status] of [['Geen enkel ticket gescand', 'none'], ['Gedeeltelijk gescand', 'partial'], ['Alle tickets gescand', 'all']] as const) {
            test(`Ticket scan status: ${option}`, async ({ browser }) => {
                await check(browser, {
                    apply: table => table.addChoiceFilter('Ticket scanstatus', [option]),
                    expected: () => orders.filter(o => ticketScanStatus(o) === status),
                });
            });
        }

        test('Amount of tickets', async ({ browser }) => {
            await check(browser, {
                apply: table => table.addNumberFilter('Aantal aangemaakte tickets', 'Groter dan...', 1),
                expected: () => orders.filter(o => (o.seed.tickets ?? []).length > 1),
            });
        });
    });

    test('Two filters, a search and a sort together', async ({ browser }) => {
        const { context, table, backend } = await openOrdersList(browser, shop);
        await table.expectCount(orders.length);

        await table.addChoiceFilter('Status', ['Nieuw', 'Verwerkt']);
        await table.addNumberFilter('Bedrag', 'Groter dan...', 3);
        await table.search('e');

        const expected = orders.filter(o => [OrderStatus.Created, OrderStatus.Prepared].includes(o.seed.status!) && (o.seed.price ?? 0) > 3_0000 && o.name.toLowerCase().includes('e'));
        expect(expected.length).toBeGreaterThan(3);

        await expectOrders({
            table,
            backend,
            webshopId: shop.webshop.id,
            all: orders,
            expected,
            filtered: true,
            search: 'e',
            backendFilter: { $and: [{ status: { $in: [OrderStatus.Created, OrderStatus.Prepared] } }, { totalPrice: { $gt: 3_0000 } }] },
        });

        await table.sortOn('Bedrag', 'ASC');
        expect(await table.readNames(names(orders))).toEqual(names(sortOrders(expected, o => o.seed.price ?? 0, 'ASC')));

        await context.close();
    });
});
