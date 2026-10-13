import { expect } from '@playwright/test';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import type { BackendOrders, TestOrder } from '../../helpers/index.js';
import type { OrdersTable } from '../../helpers/page/webshop/OrdersTable.js';

export type Direction = 'ASC' | 'DESC';

/**
 * Sorts the orders the way the orders table does: on the value of the sort column, then on the order id, both in
 * the same direction. Strings are compared after lowercasing them, character by character.
 */
export function sortOrders(orders: TestOrder[], getValue: (order: TestOrder) => string | number, direction: Direction): TestOrder[] {
    const sign = direction === 'ASC' ? 1 : -1;
    const key = (order: TestOrder) => {
        const value = getValue(order);
        return typeof value === 'string' ? value.toLocaleLowerCase() : value;
    };
    return [...orders].sort((a, b) => {
        const valueA = key(a);
        const valueB = key(b);
        if (valueA !== valueB) {
            return sign * (valueA < valueB ? -1 : 1);
        }
        return sign * (a.order.id < b.order.id ? -1 : 1);
    });
}

export function names(orders: TestOrder[]): string[] {
    return orders.map(o => o.name);
}

export function numbers(orders: TestOrder[]): number[] {
    return orders.map(o => o.seed.number);
}

export function ticketScanStatus(order: TestOrder): 'none' | 'partial' | 'all' {
    const tickets = order.seed.tickets ?? [];
    const scanned = tickets.filter(t => t.scannedAt).length;
    if (scanned === 0) {
        return 'none';
    }
    return scanned === tickets.length ? 'all' : 'partial';
}

/**
 * Checks that the table shows exactly the expected orders (sorted on number, descending: the default sort), with
 * the right count. With a backendFilter, the backend endpoints must return the same orders for that filter and the
 * search of the table.
 */
export async function expectOrders(options: {
    table: OrdersTable;
    backend: BackendOrders;
    webshopId: string;
    all: TestOrder[];
    expected: TestOrder[];
    /** Whether a filter or search is active: the count then shows 'x van y'. */
    filtered: boolean;
    search?: string;
    backendFilter?: StamhoofdFilter | null;
}) {
    const { table, backend, all, expected } = options;
    const sorted = sortOrders(expected, o => o.seed.number, 'DESC');

    await table.expectCount(sorted.length, options.filtered ? all.length : undefined);
    expect(await table.readNames(names(all)), 'orders in the table').toEqual(names(sorted));

    if (options.backendFilter !== undefined) {
        const query = { webshopId: options.webshopId, filter: options.backendFilter, search: options.search ?? null };
        expect(await backend.getNumbers(query), 'orders of the backend').toEqual(numbers(sorted));
        expect(await backend.getCount(query), 'count of the backend').toBe(sorted.length);
    }
}
