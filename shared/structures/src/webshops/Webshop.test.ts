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

    it('behaves as Single for a Cart webshop with a single unique product', () => {
        const webshop = createWebshop({ orderMode: WebshopOrderMode.Cart, products: [Product.create({ name: 'Only' })] });
        expect(webshop.canEnableCart).toBe(false);
        expect(webshop.orderMode).toBe(WebshopOrderMode.Single);
        expect(webshop.shouldEnableCart).toBe(false);

        const bulk = createWebshop({ orderMode: WebshopOrderMode.Bulk, products: [Product.create({ name: 'Only' })] });
        expect(bulk.orderMode).toBe(WebshopOrderMode.Bulk);
    });
});
