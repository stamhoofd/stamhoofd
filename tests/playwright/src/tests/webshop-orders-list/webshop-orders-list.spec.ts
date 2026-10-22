import { setup, test } from '../../test-fixtures/base.js';

setup();

import { expect } from '@playwright/test';
import { SortItemDirection } from '@stamhoofd/structures/filters/SortList.js';
import { OrderStatus } from '@stamhoofd/structures/webshops/Order.js';
import { WebshopTicketType } from '@stamhoofd/structures/webshops/WebshopMetaData.js';
import { TestUtils } from '@stamhoofd/test-utils';
import type { TestOrder } from '../../helpers/index.js';
import { TestOrders } from '../../helpers/index.js';
import { mixedOrderSeeds } from './data.js';
import { names, numbers, sortOrders, ticketScanStatus } from './expected.js';
import type { OrdersListWebshop, TestDevice } from './setup.js';
import { createOrdersListWebshop, openOrdersList, statusNames } from './setup.js';

/**
 * The orders table filters, searches and sorts the orders in the local database of the browser, while an
 * e-mail or a Mailchimp sync selects the same orders with the backend endpoints. These tests read the whole
 * table (scrolling through every page) and compare it with the expected orders and with the backend.
 */
test.describe('Orders list @webshop-orders-list', () => {
    let shop: OrdersListWebshop;
    let orders: TestOrder[];

    test.describe.configure({ timeout: 5 * 60_000 });

    test.beforeAll(async () => {
        test.setTimeout(5 * 60_000);
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        shop = await createOrdersListWebshop('OrdersList', { ticketType: WebshopTicketType.Tickets });
        orders = await TestOrders.create(shop.webshop, mixedOrderSeeds(150, { withTickets: true }));
    });

    const runCombinedTest = (device: TestDevice) => async ({ browser }: { browser: import('@playwright/test').Browser }) => {
        const { context, table, backend } = await openOrdersList(browser, shop, device);
        const allNames = names(orders);

        // Everything, sorted on number (the default sort)
        await table.expectCount(orders.length);
        await table.sortOn('#', 'DESC');
        expect(await table.readNames(allNames)).toEqual(names(sortOrders(orders, o => o.seed.number, 'DESC')));
        expect(await backend.getNumbers({ webshopId: shop.webshop.id })).toEqual(numbers(sortOrders(orders, o => o.seed.number, 'DESC')));

        // A filter
        const statusFilter = [OrderStatus.Canceled, OrderStatus.Collect];
        await table.addChoiceFilter('Status', statusFilter.map(s => statusNames[s]));
        const filtered = orders.filter(o => statusFilter.includes(o.seed.status!));
        await table.expectCount(filtered.length, orders.length);
        expect(await table.readNames(allNames)).toEqual(names(sortOrders(filtered, o => o.seed.number, 'DESC')));

        const backendFilter = { status: { $in: statusFilter } };
        expect(await backend.getNumbers({ webshopId: shop.webshop.id, filter: backendFilter })).toEqual(numbers(sortOrders(filtered, o => o.seed.number, 'DESC')));

        // The filter and a search
        await table.search('anna');
        const searched = filtered.filter(o => o.name.toLowerCase().includes('anna'));
        expect(searched.length).toBeGreaterThan(5);
        await table.expectCount(searched.length, orders.length);
        expect(await table.readNames(allNames)).toEqual(names(sortOrders(searched, o => o.seed.number, 'DESC')));
        expect(await backend.getCount({ webshopId: shop.webshop.id, filter: backendFilter, search: 'anna' })).toBe(searched.length);

        // Sorting the search on another column, in both directions
        await table.sortOn('Naam', 'ASC');
        expect(await table.readNames(allNames)).toEqual(names(sortOrders(searched, o => o.name, 'ASC')));
        await table.sortOn('Naam', 'DESC');
        expect(await table.readNames(allNames)).toEqual(names(sortOrders(searched, o => o.name, 'DESC')));

        // The backend sorts on number too
        await table.sortOn('#', 'ASC');
        const backendNumbers = await backend.getNumbers({ webshopId: shop.webshop.id, filter: backendFilter, search: 'anna', sort: [{ key: 'number', order: SortItemDirection.ASC }] });
        expect((await table.readNames(allNames))).toEqual(names(sortOrders(searched, o => o.seed.number, 'ASC')));
        expect(backendNumbers).toEqual(numbers(sortOrders(searched, o => o.seed.number, 'ASC')));

        // Without the search, a filter on the tickets (only in the dashboard: the backend has no ticket filters)
        await table.search('');
        await table.addChoiceFilter('Ticket scanstatus', ['Alle tickets gescand']);
        const allScanned = filtered.filter(o => ticketScanStatus(o) === 'all');
        expect(allScanned.length).toBeGreaterThan(5);
        await table.expectCount(allScanned.length, orders.length);
        expect(await table.readNames(allNames)).toEqual(names(sortOrders(allScanned, o => o.seed.number, 'ASC')));

        await expect(table.getErrorBox()).toHaveCount(0);
        await context.close();
    };

    test('Filtering, searching, sorting and scrolling match the expected orders and the backend', runCombinedTest('desktop'));

    test('Filtering, searching, sorting and scrolling on a phone @extra', runCombinedTest('phone'));

    test('A search shows the tickets of the orders it finds', async ({ browser }) => {
        // The tickets of an order are stored apart from the order and only read for the orders a search keeps
        const { context, table } = await openOrdersList(browser, shop);
        const isUniqueName = (o: TestOrder) => orders.filter(other => other.name.toLowerCase().includes(o.name.toLowerCase())).length === 1;
        const order = orders.find(o => o.tickets.length >= 2 && ticketScanStatus(o) === 'partial' && isUniqueName(o))!;
        const scanned = order.seed.tickets!.filter(t => t.scannedAt).length;

        await table.search(order.name);
        await table.expectCount(1, orders.length);
        await expect(table.getOrderRow(order.name)).toContainText(`${scanned} / ${order.tickets.length}`);
        await expect(table.getErrorBox()).toHaveCount(0);

        await context.close();
    });

    test('A phone search with more matches than one page keeps every order in a sort on name', async ({ browser }) => {
        // A complete phone number is looked up in the index: its matches are sorted in memory and paged after the last order
        const phoneShop = await createOrdersListWebshop('OrdersPhone');
        const seeds = mixedOrderSeeds(135).map((seed, i) => (i < 130 ? { ...seed, phone: '+32 478 12 34 56' } : seed));
        const phoneOrders = await TestOrders.create(phoneShop.webshop, seeds);
        const matches = phoneOrders.filter(o => o.seed.phone);

        const { context, table } = await openOrdersList(browser, phoneShop);
        await table.search('0478 12 34 56');
        await table.expectCount(matches.length, phoneOrders.length);
        await table.sortOn('Naam', 'ASC');
        expect(await table.readNames(names(phoneOrders))).toEqual(names(sortOrders(matches, o => o.name, 'ASC')));

        await context.close();
    });

    test('A search after a search with one result shows every row on a phone', async ({ browser }) => {
        // While the count of a new search loads, the table must draw every row that already loaded
        const { context, table } = await openOrdersList(browser, shop, 'phone');

        await table.search('5');
        await table.expectCount(1, orders.length);
        await expect(table.getRows()).toHaveCount(1);

        const annas = sortOrders(orders.filter(o => o.name.toLowerCase().includes('anna')), o => o.seed.number, 'DESC');
        await table.search('anna');
        await expect(table.getOrderRow(annas[0].name)).toBeVisible();
        await expect(table.getOrderRow(annas[1].name)).toBeVisible();
        await table.expectCount(annas.length, orders.length);

        await context.close();
    });
});
