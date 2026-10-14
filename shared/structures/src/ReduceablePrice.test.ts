import { ReduceablePrice } from './ReduceablePrice.js';

describe('ReduceablePrice', () => {
    test('selects the standard or reduced price', () => {
        const price = ReduceablePrice.create({ price: 10_00_00, reducedPrice: 5_00_00 });

        expect(price.getPrice(false)).toBe(10_00_00);
        expect(price.getPrice(true)).toBe(5_00_00);
    });

    test('falls back to the standard price when no reduced price exists', () => {
        const price = ReduceablePrice.create({ price: 10_00_00 });

        expect(price.getPrice(false)).toBe(10_00_00);
        expect(price.getPrice(true)).toBe(10_00_00);
    });

    test('preserves a zero reduced price', () => {
        const price = ReduceablePrice.create({ price: 10_00_00, reducedPrice: 0 });

        expect(price.getPrice(true)).toBe(0);
    });
});
