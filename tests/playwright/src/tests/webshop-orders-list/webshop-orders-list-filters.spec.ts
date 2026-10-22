import { setup, test } from '../../test-fixtures/base.js';

setup();

import { expect } from '@playwright/test';
import type { StamhoofdFilter } from '@stamhoofd/filters/StamhoofdFilterTypes';
import { OrderStatus } from '@stamhoofd/structures/webshops/Order.js';
import { WebshopTicketType } from '@stamhoofd/structures/webshops/WebshopMetaData.js';
import { TestUtils } from '@stamhoofd/test-utils';
import type { TestOrder } from '../../helpers/index.js';
import { TestOrders } from '../../helpers/index.js';
import type { DateFilterMode, NumberFilterMode, OrdersTable, StringFilterMode } from '../../helpers/page/webshop/OrdersTable.js';
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
            { filter: 'Naam', key: 'name', mode: 'Is gelijk aan...', value: 'jose muller', expected: [1, 2] },
            { filter: 'Naam', key: 'name', mode: 'Bevat...', value: 'orsted', expected: [9] },
            // Characters with a meaning in SQL LIKE
            { filter: 'Naam', key: 'name', mode: 'Bevat...', value: '%', expected: [7] },
            { filter: 'Naam', key: 'name', mode: 'Bevat...', value: '_', expected: [7] },
            { filter: 'Naam', key: 'name', mode: 'Bevat...', value: 'o\'brien', expected: [8] },
            // Negations
            { filter: 'Naam', key: 'name', mode: 'Bevat niet...', value: 'klant', expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
            { filter: 'Naam', key: 'name', mode: 'Is niet gelijk aan...', value: 'josé müller', expected: [3, 4, 5, 6, 7, 8, 9, 10, 11, 20, 100, 1000] },
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
            // Spaces around the search are ignored, spaces inside it count
            { search: ' jose ', expected: [1, 2] },
            { search: 'van  damme', expected: [6] },
            { search: 'van damme', expected: [] },
            // Characters with a meaning in SQL LIKE
            { search: '100%', expected: [7] },
            { search: 'o\'brien', expected: [8] },
            // A complete e-mail address is looked up exactly, part of one with a contains
            { search: 'JOSE.MULLER@example.com', expected: [1, 2] },
            { search: 'peeters@', expected: [10] },
            // Phone numbers, in another notation than they are stored
            { search: '0478 12 34 56', expected: [10] },
            { search: '0478123456', expected: [10] },
            // Not an assigned number: searched as a name
            { search: '0412345678', expected: [] },
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

    test.describe('Ticket filters', () => {
        for (const [option, status] of [['Geen enkel ticket gescand', 'none'], ['Gedeeltelijk gescand', 'partial'], ['Alle tickets gescand', 'all']] as const) {
            test(`Ticket scan status: ${option}`, async ({ browser }) => {
                await check(browser, {
                    apply: table => table.addChoiceFilter('Ticket scanstatus', [option]),
                    expected: () => orders.filter(o => ticketScanStatus(o) === status),
                    backendFilter: { ticketScanStatus: { $in: [status] } },
                });
            });
        }

        test('E-mailing the orders of a ticket filter reaches the orders of the table', async ({ browser }) => {
            const { context, page, table } = await openOrdersList(browser, shop);
            await table.addChoiceFilter('Ticket scanstatus', ['Alle tickets gescand']);
            const expected = orders.filter(o => ticketScanStatus(o) === 'all');
            await table.expectCount(expected.length, orders.length);

            await table.clickAction('E-mailen');
            const recipients = page.locator('.right-stack').filter({ has: page.locator('.list-input-box') }).first();
            await expect(recipients.locator('.icon.error')).toHaveCount(0);
            await expect(recipients.locator('.style-description-small')).toHaveText(expected.length.toString());

            await context.close();
        });

        // Without a scanned ticket, the first scan is empty, which compares as earlier than any date (like in MySQL)
        const firstScan = (o: TestOrder) => Math.min(...(o.seed.tickets ?? []).filter(t => t.scannedAt).map(t => t.scannedAt!.getTime()), Infinity);
        // Days in Belgian time (UTC+1 in March)
        const scanDateCases: { mode: DateFilterMode; date: Date; backendFilter: StamhoofdFilter; matches: (o: TestOrder) => boolean }[] = [
            { mode: 'Gelijk aan...', date: new Date(2026, 2, 1), backendFilter: { $and: [{ ticketScannedAt: { $gte: new Date('2026-02-28T23:00:00.000Z') } }, { ticketScannedAt: { $lte: new Date('2026-03-01T22:59:59.999Z') } }] }, matches: o => firstScan(o) !== Infinity },
            { mode: 'Groter dan...', date: new Date(2026, 1, 28), backendFilter: { ticketScannedAt: { $gt: new Date('2026-02-28T22:59:59.999Z') } }, matches: o => firstScan(o) !== Infinity },
            { mode: 'Kleiner dan...', date: new Date(2026, 2, 1), backendFilter: { ticketScannedAt: { $lt: new Date('2026-02-28T23:00:00.000Z') } }, matches: o => firstScan(o) === Infinity },
        ];

        for (const c of scanDateCases) {
            test(`Ticket scan time ${c.mode} ${c.date.toDateString()}`, async ({ browser }) => {
                await check(browser, {
                    apply: table => table.addDateFilter('Ticket scan tijdstip', c.mode, c.date),
                    expected: () => orders.filter(c.matches),
                    backendFilter: c.backendFilter,
                });
            });
        }

        test('Amount of tickets', async ({ browser }) => {
            await check(browser, {
                apply: table => table.addNumberFilter('Aantal aangemaakte tickets', 'Groter dan...', 1),
                expected: () => orders.filter(o => (o.seed.tickets ?? []).length > 1),
                backendFilter: { ticketCount: { $gt: 1 } },
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
