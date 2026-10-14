import { GroupPriceDiscount, GroupPriceDiscountType } from './GroupPriceDiscount.js';
import { ReduceablePrice } from './ReduceablePrice.js';

describe('GroupPriceDiscount', () => {
    test.each([
        [GroupPriceDiscountType.Fixed, false, 2_00_00],
        [GroupPriceDiscountType.Fixed, true, 1_00_00],
        [GroupPriceDiscountType.Percentage, false, 2_00_00],
        [GroupPriceDiscountType.Percentage, true, 1_00_00],
    ])('%s selects the discount for reduced pricing %s', (type, isReduced, expected) => {
        const discount = GroupPriceDiscount.create({
            type,
            value: type === GroupPriceDiscountType.Fixed
                ? ReduceablePrice.create({ price: 2_00_00, reducedPrice: 1_00_00 })
                : ReduceablePrice.create({ price: 20_00, reducedPrice: 10_00 }),
        });

        expect(discount.calculateDiscount(10_00_00, isReduced)).toBe(expected);
    });

    test.each([GroupPriceDiscountType.Fixed, GroupPriceDiscountType.Percentage])('%s clamps discounts to the price', (type) => {
        const discount = GroupPriceDiscount.create({ type, value: ReduceablePrice.create({ price: 200_00_00 }) });

        expect(discount.calculateDiscount(10_00_00, false)).toBe(10_00_00);
        expect(discount.calculateDiscount(0, true)).toBe(0);
    });

    test('percentage discounts round to cents', () => {
        const discount = GroupPriceDiscount.create({ value: ReduceablePrice.create({ price: 33_33 }) });

        expect(discount.calculateDiscount(1_00_00, false)).toBe(33_00);
    });
});
