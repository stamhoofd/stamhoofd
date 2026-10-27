import { describe, expect, it } from 'vitest';

import { Product, ProductPrice } from './Product.js';
import { Webshop } from './Webshop.js';
import { WebshopMetaData, WebshopOrderMode } from './WebshopMetaData.js';

function createWebshop({ orderMode, products }: { orderMode: WebshopOrderMode; products?: Product[] }) {
    return Webshop.create({
        meta: WebshopMetaData.create({ orderMode }),
        products: products ?? [
            Product.create({ name: 'A', prices: [ProductPrice.create({ name: 'A1' }), ProductPrice.create({ name: 'A2' })] }),
            Product.create({ name: 'B' }),
        ],
    });
}

describe('Webshop.orderMode', () => {
    it('follows the order mode of the settings', () => {
        expect(createWebshop({ orderMode: WebshopOrderMode.Cart }).orderMode).toBe(WebshopOrderMode.Cart);
        expect(createWebshop({ orderMode: WebshopOrderMode.Cart }).shouldEnableCart).toBe(true);
        expect(createWebshop({ orderMode: WebshopOrderMode.Single }).orderMode).toBe(WebshopOrderMode.Single);
        expect(createWebshop({ orderMode: WebshopOrderMode.Bulk }).orderMode).toBe(WebshopOrderMode.Bulk);
        expect(createWebshop({ orderMode: WebshopOrderMode.Bulk }).shouldEnableCart).toBe(false);
    });

    it('keeps a cart for a single unique product', () => {
        const webshop = createWebshop({ orderMode: WebshopOrderMode.Cart, products: [Product.create({ name: 'Only' })] });
        expect(webshop.canEnableCart).toBe(false);
        expect(webshop.orderMode).toBe(WebshopOrderMode.Cart);
        expect(webshop.shouldEnableCart).toBe(true);
    });
});

describe('Webshop.allowsMultiple', () => {
    const product = Product.create({ name: 'Only' });

    it('follows the chosen order mode for a product without its own setting', () => {
        expect(createWebshop({ orderMode: WebshopOrderMode.Cart, products: [product] }).allowsMultiple(product)).toBe(true);
        expect(createWebshop({ orderMode: WebshopOrderMode.Bulk, products: [product] }).allowsMultiple(product)).toBe(true);
        expect(createWebshop({ orderMode: WebshopOrderMode.Single, products: [product] }).allowsMultiple(product)).toBe(false);
    });

    it('uses the setting of the product when it has one', () => {
        const legacy = Product.create({ name: 'Legacy', allowMultiple: true });
        expect(createWebshop({ orderMode: WebshopOrderMode.Single, products: [legacy] }).allowsMultiple(legacy)).toBe(true);

        const unique = Product.create({ name: 'Unique', allowMultiple: false });
        expect(createWebshop({ orderMode: WebshopOrderMode.Cart, products: [unique] }).allowsMultiple(unique)).toBe(false);
    });
});
