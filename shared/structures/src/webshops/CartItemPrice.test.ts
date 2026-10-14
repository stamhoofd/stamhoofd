import { ObjectData } from '@simonbackx/simple-encoding';
import { Version } from '../Version.js';
import { CartItemPrice as LegacyCartItemPrice } from './CartItem.js';
import { CartItemPrice } from './CartItemPrice.js';

describe('CartItemPrice', () => {
    test('the existing export retains the canonical decoder identity', () => {
        expect(LegacyCartItemPrice).toBe(CartItemPrice);
    });

    test('encoding preserves prices and discounts', () => {
        const price = CartItemPrice.create({ price: 10_00_00, fixedDiscount: 1_00_00, percentageDiscount: 25_00 });
        const decoded = LegacyCartItemPrice.decode(new ObjectData(price.encode({ version: Version }), { version: Version }));

        expect(decoded).toBeInstanceOf(CartItemPrice);
        expect(decoded.price).toBe(price.price);
        expect(decoded.fixedDiscount).toBe(price.fixedDiscount);
        expect(decoded.percentageDiscount).toBe(price.percentageDiscount);
        expect(decoded.discountedPrice).toBe(6_50_00);
    });
});
