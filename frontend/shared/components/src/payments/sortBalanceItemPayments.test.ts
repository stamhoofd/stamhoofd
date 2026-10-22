import { BalanceItem, BalanceItemPaymentDetailed } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { sortBalanceItemPayments } from './sortBalanceItemPayments';

function createItem(name: string, options: { createdAt: Date; dueAt?: Date | null; price?: number }) {
    return BalanceItemPaymentDetailed.create({
        price: options.price ?? 10_00_00,
        balanceItem: BalanceItem.create({
            name,
            createdAt: options.createdAt,
            dueAt: options.dueAt ?? null,
        }),
    });
}

function names(items: BalanceItemPaymentDetailed[]) {
    return items.map(i => i.balanceItem.name);
}

describe('sortBalanceItemPayments', () => {
    test('items are sorted from old to new, by due date first and creation date second', () => {
        const items = [
            createItem('created in march', { createdAt: new Date(2026, 2, 1), price: 50_00_00 }),
            createItem('due in june', { createdAt: new Date(2025, 0, 1), dueAt: new Date(2026, 5, 1) }),
            createItem('created in january', { createdAt: new Date(2026, 0, 1), price: 1_00_00 }),
            createItem('due in april', { createdAt: new Date(2025, 0, 1), dueAt: new Date(2026, 3, 1) }),
        ];

        expect(names(sortBalanceItemPayments(items))).toEqual([
            'created in january',
            'created in march',
            'due in april',
            'due in june',
        ]);
    });

    test('items with the same date are sorted by price and then by name', () => {
        const createdAt = new Date(2026, 0, 1);
        const items = [
            createItem('B', { createdAt, price: 5_00_00 }),
            createItem('C', { createdAt, price: 20_00_00 }),
            createItem('A', { createdAt, price: 5_00_00 }),
        ];

        expect(names(sortBalanceItemPayments(items))).toEqual(['C', 'A', 'B']);
    });

    test('the original array is not modified', () => {
        const items = [
            createItem('new', { createdAt: new Date(2026, 1, 1) }),
            createItem('old', { createdAt: new Date(2026, 0, 1) }),
        ];
        sortBalanceItemPayments(items);
        expect(names(items)).toEqual(['new', 'old']);
    });
});
