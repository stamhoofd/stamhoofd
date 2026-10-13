import { setup, test } from '../../test-fixtures/base.js';

setup();

import type { Browser } from '@playwright/test';
import { expect } from '@playwright/test';
import { SortItemDirection } from '@stamhoofd/structures/filters/SortList.js';
import { OrderStatus } from '@stamhoofd/structures/webshops/Order.js';
import { TestUtils } from '@stamhoofd/test-utils';
import type { TestOrder } from '../../helpers/index.js';
import { TestOrders } from '../../helpers/index.js';
import { mixedOrderSeeds } from './data.js';
import type { Direction } from './expected.js';
import { names, numbers, sortOrders } from './expected.js';
import type { OrdersListWebshop, TestDevice } from './setup.js';
import { createOrdersListWebshop, openOrdersList, statusNames } from './setup.js';

const columns: { name: string; getValue: (order: TestOrder) => string | number; backendKey?: string }[] = [
    { name: '#', getValue: o => o.seed.number, backendKey: 'number' },
    { name: 'Naam', getValue: o => o.name },
    { name: 'E-mailadres', getValue: o => o.seed.email! },
    // On the stored value of the status, not on its name
    { name: 'Status', getValue: o => o.seed.status! },
    // validAt, which the test orders share with createdAt: the backend sorts on createdAt
    { name: 'Besteldatum', getValue: o => o.seed.createdAt!.getTime(), backendKey: 'createdAt' },
    { name: 'Bedrag', getValue: o => o.seed.price! },
    { name: 'Aantal', getValue: o => o.seed.amount! },
];

/**
 * Sorting happens in the local order database of the browser. Each page of the table continues after the last
 * order of the previous page, so a sort that is not strict (equal values, e.g. orders created in the same second)
 * loses or repeats orders while scrolling. These tests read every row of the table to catch that.
 */
test.describe('Orders list sorting @webshop-orders-list @extra', () => {
    test.describe.configure({ timeout: 4 * 60_000 });

    let shop: OrdersListWebshop;
    let orders: TestOrder[];

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        shop = await createOrdersListWebshop('OrdersSorting');
        orders = await TestOrders.create(shop.webshop, mixedOrderSeeds(120));
    });

    async function expectSorted(browser: Browser, device: TestDevice, columnNames: string[], options: { statusFilter?: OrderStatus[] } = {}) {
        const { context, table, backend } = await openOrdersList(browser, shop, device);
        await table.expectCount(orders.length);

        let expectedOrders = orders;
        if (options.statusFilter) {
            const statusFilter = options.statusFilter;
            await table.addChoiceFilter('Status', statusFilter.map(s => statusNames[s]));
            expectedOrders = orders.filter(o => statusFilter.includes(o.seed.status!));
            await table.expectCount(expectedOrders.length, orders.length);
        }

        for (const columnName of columnNames) {
            const column = columns.find(c => c.name === columnName)!;

            for (const direction of ['ASC', 'DESC'] as Direction[]) {
                await table.sortOn(column.name, direction);
                const expected = sortOrders(expectedOrders, column.getValue, direction);
                expect(await table.readNames(names(orders)), `${column.name} ${direction}`).toEqual(names(expected));

                if (column.backendKey) {
                    const backendNumbers = await backend.getNumbers({
                        webshopId: shop.webshop.id,
                        filter: options.statusFilter ? { status: { $in: options.statusFilter } } : null,
                        sort: [{ key: column.backendKey, order: direction === 'ASC' ? SortItemDirection.ASC : SortItemDirection.DESC }],
                    });
                    expect(backendNumbers, `backend ${column.name} ${direction}`).toEqual(numbers(expected));
                }
            }
        }

        await expect(table.getErrorBox()).toHaveCount(0);
        await context.close();
    }

    for (const column of columns) {
        test(`On ${column.name}, in both directions`, async ({ browser }) => {
            await expectSorted(browser, 'desktop', [column.name]);
        });
    }

    test('With a filter', async ({ browser }) => {
        await expectSorted(browser, 'desktop', ['Bedrag', 'Besteldatum'], { statusFilter: [OrderStatus.Created, OrderStatus.Canceled] });
    });

    for (const device of ['phone', 'tablet'] as TestDevice[]) {
        test(`On a ${device}`, async ({ browser }) => {
            await expectSorted(browser, device, ['#', 'Naam'], { statusFilter: [OrderStatus.Prepared, OrderStatus.Completed, OrderStatus.Collect] });
        });
    }
});
