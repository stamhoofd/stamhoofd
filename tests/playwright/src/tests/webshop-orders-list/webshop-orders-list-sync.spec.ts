import { setup, test } from '../../test-fixtures/base.js';

setup();

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { Order, Ticket } from '@stamhoofd/models';
import { OrderStatus, WebshopTicketType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import type { TestOrder } from '../../helpers/index.js';
import { TestOrders } from '../../helpers/index.js';
import type { OrdersTable } from '../../helpers/page/webshop/OrdersTable.js';
import { mixedOrderSeeds } from './data.js';
import { expectOrders, names, ticketScanStatus } from './expected.js';
import type { OrdersListWebshop } from './setup.js';
import { createOrdersListWebshop, openOrdersList, openOrdersTab, statusNames } from './setup.js';

/**
 * Tabs of the same browser share one local order database, while each tab keeps its own table and caches. Other
 * devices change orders and tickets on the server, which a tab only learns about when it syncs.
 */
test.describe('Orders list changes @webshop-orders-list', () => {
    test.describe.configure({ timeout: 4 * 60_000 });

    let shop: OrdersListWebshop;
    let orders: TestOrder[];

    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.beforeEach(async () => {
        shop = await createOrdersListWebshop('OrdersSync', { ticketType: WebshopTicketType.Tickets });
        orders = await TestOrders.create(shop.webshop, mixedOrderSeeds(30, { withTickets: true }));
    });

    /**
     * A tab only syncs when it reads the first page of the table, at most once every 5 seconds.
     */
    async function syncNow(page: Page, table: OrdersTable) {
        await page.waitForTimeout(5_500);
        await table.search('-');
        await table.search('');
    }

    test('Changes and deletes in one tab are stored and show up in another tab', async ({ browser }) => {
        const { context, page: pageA, table: tableA } = await openOrdersList(browser, shop);
        const { page: pageB, table: tableB } = await openOrdersTab(context, shop);
        await tableA.expectCount(30);
        await tableB.expectCount(30);

        const canceled = orders.find(o => o.seed.status !== OrderStatus.Canceled)!;
        const deleted = orders.find(o => o.seed.status === OrderStatus.Canceled)!;
        const scanned = orders.find(o => o.tickets.length >= 2 && ticketScanStatus(o) === 'none')!;

        // Tab A cancels an order: tab B finds it with a filter on canceled orders
        await tableA.changeStatus([canceled.name], statusNames[OrderStatus.Canceled]);
        await tableA.expectOrderRowText(canceled.name, statusNames[OrderStatus.Canceled]);

        await tableB.addChoiceFilter('Status', [statusNames[OrderStatus.Canceled]]);
        const canceledOrders = [...orders.filter(o => o.seed.status === OrderStatus.Canceled), canceled];
        await tableB.expectCount(canceledOrders.length, 30);
        expect(await tableB.readNames(names(orders))).toEqual(expect.arrayContaining([canceled.name]));

        // Tab B deletes one of them: tab A no longer finds it
        await tableB.deleteOrders([deleted.name]);
        await tableB.expectCount(canceledOrders.length - 1, 29);
        await tableA.search(deleted.name);
        await tableA.expectCount(0, 29);
        await tableA.search('');
        await tableA.expectCount(29);

        // Tab A marks the tickets of an order as scanned
        await tableA.changeTicketStatus([scanned.name], 'Gescand');
        const ticketCount = scanned.seed.tickets!.length;
        await tableA.expectOrderRowText(scanned.name, `${ticketCount} / ${ticketCount}`);

        // Everything is stored on the server
        await expect.poll(async () => (await Order.getByID(canceled.order.id))!.status).toBe(OrderStatus.Canceled);
        await expect.poll(async () => (await Order.getByID(deleted.order.id))!.status).toBe(OrderStatus.Deleted);
        await expect.poll(async () => {
            const tickets = await Ticket.where({ orderId: scanned.order.id });
            return tickets.every(t => t.scannedAt !== null);
        }).toBe(true);

        // A reloaded tab B reads the same from the local database
        await pageB.reload();
        await tableB.addChoiceFilter('Ticket scanstatus', ['Alle tickets gescand']);
        // Canceling an order deletes its tickets
        const allScanned = [...orders.filter(o => ticketScanStatus(o) === 'all' && o !== deleted && o !== canceled), scanned];
        expect((await tableB.readNames(names(orders))).sort()).toEqual(names(allScanned).sort());
        await tableB.expectCount(allScanned.length, 29);

        await pageA.close();
        await context.close();
    });

    test('A tab finds an order that another tab fetched from the server', async ({ browser }) => {
        // Tabs share the local database and its sync cursor: tab A never fetches a change that tab B already fetched
        const { context, page: pageA, table: tableA } = await openOrdersList(browser, shop);
        await tableA.search('klant 1');
        await tableA.expectCount(orders.filter(o => o.name.toLowerCase().includes('klant 1')).length, 30);

        // Tab A can only learn about changes through the local database from now on
        await pageA.route(/\/webshop\/orders/, route => route.abort());

        const renamed = orders[0];
        const data = renamed.order.data.clone();
        data.customer.firstName = 'Hernoemd';
        renamed.order.data = data;
        await renamed.order.save();

        const tabB = await openOrdersTab(context, shop);
        await tabB.table.expectCount(30);
        await tabB.table.expectOrderRowText(data.customer.name, data.customer.name);

        await tableA.search('hernoemd');
        await tableA.expectCount(1, 30);
        await expect(tableA.getOrderRow(data.customer.name)).toBeVisible();

        await context.close();
    });

    test('Changing an order in a filtered table moves it out of the filter right away @extra', async ({ browser }) => {
        const { context, table, backend } = await openOrdersList(browser, shop);
        await table.addChoiceFilter('Status', [statusNames[OrderStatus.Created]]);
        const created = orders.filter(o => o.seed.status === OrderStatus.Created);
        await table.expectCount(created.length, 30);

        await table.changeStatus([created[0].name], statusNames[OrderStatus.Prepared]);
        await expectOrders({
            table,
            backend,
            webshopId: shop.webshop.id,
            all: orders,
            expected: created.slice(1),
            filtered: true,
            backendFilter: { status: { $in: [OrderStatus.Created] } },
        });

        await context.close();
    });

    test('New, changed and deleted orders on the server are fetched @extra', async ({ browser }) => {
        const { context, page, table, backend } = await openOrdersList(browser, shop);
        await table.addChoiceFilter('Status', [statusNames[OrderStatus.Created]]);
        const created = orders.filter(o => o.seed.status === OrderStatus.Created);
        await table.expectCount(created.length, 30);

        // Another device adds, completes, deletes and renames orders
        const added = await TestOrders.createOne(shop.webshop, { number: 31, firstName: 'Nieuwe', lastName: 'Klant 31', status: OrderStatus.Created });
        const [completed, removed, renamed] = created;

        completed.order.status = OrderStatus.Completed;
        await completed.order.save();

        removed.order.status = OrderStatus.Deleted;
        await removed.order.save();

        const data = renamed.order.data.clone();
        data.customer.firstName = 'Hernoemd';
        renamed.order.data = data;
        await renamed.order.save();
        const renamedOrder: TestOrder = { ...renamed, name: data.customer.name };

        await syncNow(page, table);

        const all = [...orders.filter(o => o !== renamed && o !== removed), renamedOrder, added];
        await expectOrders({
            table,
            backend,
            webshopId: shop.webshop.id,
            all,
            expected: [...created.filter(o => o !== completed && o !== removed && o !== renamed), renamedOrder, added],
            filtered: true,
            backendFilter: { status: { $in: [OrderStatus.Created] } },
        });

        // A new tab of the same browser reads them from the local database
        const tab = await openOrdersTab(context, shop);
        await tab.table.expectCount(30);
        await tab.table.search('hernoemd');
        await tab.table.expectCount(1, 30);

        await context.close();
    });

    test('Tickets scanned, deleted and added on the server are fetched @extra', async ({ browser }) => {
        const { context, page, table } = await openOrdersList(browser, shop);
        await table.expectCount(30);

        const withTickets = orders.filter(o => o.tickets.length >= 2 && ticketScanStatus(o) === 'none');
        const [scannedOrder, deletedOrder] = withTickets;
        const addedOrder = orders.find(o => o.tickets.length === 0)!;

        for (const ticket of scannedOrder.tickets) {
            ticket.scannedAt = new Date();
            await ticket.save();
        }
        await deletedOrder.tickets[0].softDelete();
        await TestOrders.addTickets(addedOrder.order, [{ scannedAt: new Date() }]);

        await syncNow(page, table);

        // The order without tickets now has one scanned ticket, the deleted ticket no longer counts
        const scanStatus = (o: TestOrder) => {
            if (o === scannedOrder || o === addedOrder) {
                return 'all';
            }
            return ticketScanStatus(o);
        };

        await table.addChoiceFilter('Ticket scanstatus', ['Alle tickets gescand']);
        const allScanned = orders.filter(o => scanStatus(o) === 'all');
        await table.expectCount(allScanned.length, 30);
        expect((await table.readNames(names(orders))).sort()).toEqual(names(allScanned).sort());

        await table.expectOrderRowText(scannedOrder.name, `${scannedOrder.tickets.length} / ${scannedOrder.tickets.length}`);
        await table.search(deletedOrder.name);
        await expect(table.getOrderRow(deletedOrder.name)).toHaveCount(0);

        await context.close();
    });

    test('Two tabs changing orders at the same time end up with the state of the server @extra', async ({ browser }) => {
        const { context, page: pageA, table: tableA, backend } = await openOrdersList(browser, shop);
        const { page: pageB, table: tableB } = await openOrdersTab(context, shop);
        await tableA.expectCount(30);
        await tableB.expectCount(30);

        const created = orders.filter(o => o.seed.status === OrderStatus.Created);
        const [first, second, both] = created;

        // Different orders in both tabs, and then the same order in both tabs
        await Promise.all([
            tableA.changeStatus([first.name], statusNames[OrderStatus.Completed]),
            tableB.changeStatus([second.name], statusNames[OrderStatus.Prepared]),
        ]);
        await tableA.changeStatus([both.name], statusNames[OrderStatus.Completed]);
        await tableB.changeStatus([both.name], statusNames[OrderStatus.Canceled]);

        await expect.poll(async () => (await Order.getByID(both.order.id))!.status).toBe(OrderStatus.Canceled);

        // Each tab, reloaded, shows exactly the orders the server has for a status
        for (const [page, table] of [[pageA, tableA], [pageB, tableB]] as const) {
            await page.reload();
            await table.addChoiceFilter('Status', [statusNames[OrderStatus.Created]]);
            await expectOrders({
                table,
                backend,
                webshopId: shop.webshop.id,
                all: orders,
                expected: created.filter(o => o !== first && o !== second && o !== both),
                filtered: true,
                backendFilter: { status: { $in: [OrderStatus.Created] } },
            });
        }

        await context.close();
    });
});
