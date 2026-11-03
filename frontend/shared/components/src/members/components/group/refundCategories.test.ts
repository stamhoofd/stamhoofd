import { DeleteRegisterItem, GenericBalance, type RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { getRefundCategories, RefundCategoryType, RefundChoice } from './refundCategories.ts';

function createItem({ paid = 0, pending = 0, open = 0, cancellationFeePercentage = 0 }: { paid?: number; pending?: number; open?: number; cancellationFeePercentage?: number }) {
    const balance = GenericBalance.create({ amountPaid: paid, amountPending: pending, amountOpen: open });

    return new DeleteRegisterItem({
        // Only the balances of the registration matter here
        registration: { registration: { balances: [balance], calculatedPrice: paid + pending + open } } as unknown as RegistrationWithPlatformMember,
        cancellationFeePercentage,
    });
}

describe('getRefundCategories', () => {
    test('registrations are grouped by how much of them was paid', () => {
        const paid = createItem({ paid: 50_00 });
        const partiallyPaid = createItem({ paid: 10_00, open: 40_00 });
        const notPaid = createItem({ open: 40_00 });

        const categories = getRefundCategories([notPaid, partiallyPaid, paid]);

        expect(categories.map(c => c.type)).toEqual([
            RefundCategoryType.Paid,
            RefundCategoryType.PartiallyPaid,
            RefundCategoryType.NotPaid,
        ]);
        expect(categories.map(c => c.items)).toEqual([[paid], [partiallyPaid], [notPaid]]);
    });

    test('empty categories are left out', () => {
        const categories = getRefundCategories([createItem({ open: 40_00 })]);

        expect(categories.map(c => c.type)).toEqual([RefundCategoryType.NotPaid]);
    });

    test('registrations that were never charged are left out', () => {
        expect(getRefundCategories([createItem({})])).toEqual([]);
    });

    test('payments that are being processed count as paid', () => {
        const categories = getRefundCategories([createItem({ pending: 50_00 })]);

        expect(categories.map(c => c.type)).toEqual([RefundCategoryType.Paid]);
        expect(categories[0].amountPaid).toEqual(50_00);
    });

    test('the amounts of all registrations in a category are summed', () => {
        const categories = getRefundCategories([
            createItem({ paid: 10_00, open: 40_00 }),
            createItem({ paid: 20_00, pending: 5_00, open: 25_00 }),
        ]);

        expect(categories[0].amountPaid).toEqual(35_00);
        expect(categories[0].amountOpen).toEqual(65_00);
    });
});

describe('RefundCategory.select', () => {
    test('paid registrations are refunded in full or not at all', () => {
        const item = createItem({ paid: 50_00 });
        const [category] = getRefundCategories([item]);

        expect(category.choices).toEqual([RefundChoice.NoFee, RefundChoice.FullFee, RefundChoice.CustomFee]);

        category.select(RefundChoice.NoFee);
        expect(item.cancellationFeePercentage).toEqual(0);
        expect(category.choice).toEqual(RefundChoice.NoFee);

        category.select(RefundChoice.FullFee);
        expect(item.cancellationFeePercentage).toEqual(100_00);
        expect(category.choice).toEqual(RefundChoice.FullFee);
    });

    test('keeping the paid amount charges a fee per registration', () => {
        const quarterPaid = createItem({ paid: 10_00, open: 30_00 });
        const halfPaid = createItem({ paid: 20_00, open: 20_00 });
        const [category] = getRefundCategories([quarterPaid, halfPaid]);

        expect(category.choices).toEqual([RefundChoice.KeepPaid, RefundChoice.FullFee, RefundChoice.CustomFee]);

        category.select(RefundChoice.KeepPaid);

        expect(quarterPaid.cancellationFeePercentage).toEqual(25_00);
        expect(halfPaid.cancellationFeePercentage).toEqual(50_00);
        expect(quarterPaid.cancellationFee).toEqual(10_00);
        expect(halfPaid.cancellationFee).toEqual(20_00);
        expect(category.choice).toEqual(RefundChoice.KeepPaid);
    });

    test('a custom fee keeps the fee that is set', () => {
        const item = createItem({ open: 40_00, cancellationFeePercentage: 30_00 });
        const [category] = getRefundCategories([item]);

        expect(category.choice).toEqual(RefundChoice.CustomFee);

        category.select(RefundChoice.CustomFee);
        expect(item.cancellationFeePercentage).toEqual(30_00);

        category.cancellationFeePercentage = 40_00;
        expect(item.cancellationFeePercentage).toEqual(40_00);
    });

    test('registrations with different fees fall back to a custom fee', () => {
        const [category] = getRefundCategories([
            createItem({ open: 40_00, cancellationFeePercentage: 0 }),
            createItem({ open: 40_00, cancellationFeePercentage: 100_00 }),
        ]);

        expect(category.choice).toEqual(RefundChoice.CustomFee);
    });
});
