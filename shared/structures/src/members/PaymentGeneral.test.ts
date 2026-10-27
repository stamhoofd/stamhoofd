import { describe, expect, test } from 'vitest';
import { BalanceItem, BalanceItemType } from '../BalanceItem.js';
import { BalanceItemPaymentDetailed } from '../BalanceItemDetailed.js';
import { PaymentMethod } from '../PaymentMethod.js';
import { PaymentGeneral } from './PaymentGeneral.js';

function payment(items: [string, number][]) {
    return PaymentGeneral.create({
        method: PaymentMethod.Unknown,
        balanceItemPayments: items.map(([name, price]) => BalanceItemPaymentDetailed.create({
            price,
            balanceItem: BalanceItem.create({ name, type: BalanceItemType.Other }),
        })),
    });
}

describe('PaymentGeneral short descriptions', () => {
    test('counts repeated descriptions and excludes free items when paid items exist', () => {
        expect(payment([['camp', 100], ['camp', 200], ['free', 0]]).getShortDescription()).toBe('2 x camp');
    });

    test('includes free items when all items are free', () => {
        expect(payment([['camp', 0], ['camp', 0]]).getShortDescription()).toBe('2 x camp');
    });

    test('preserves numeric description ordering', () => {
        expect(payment([['10', 1], ['2', 1], ['10', 1]]).getShortDescription()).toBe(`2 ${$t('%M1')} 2 x 10`);
    });

    test('returns an empty description without items', () => {
        expect(payment([]).getShortDescription()).toBe('');
    });
});
