import { describe, expect, it } from 'vitest';

import { Product, ProductPrice } from './Product.js';
import { Webshop } from './Webshop.js';
import { WebshopMetaData, WebshopOrderMode } from './WebshopMetaData.js';

function createWebshop({ orderMode, cartEnabled, products }: { orderMode?: WebshopOrderMode | null; cartEnabled?: boolean; products?: Product[] }) {
    return Webshop.create({
        meta: WebshopMetaData.create({
            cartEnabled: cartEnabled ?? true,
            orderMode: orderMode ?? null,
        }),
        products: products ?? [
            Product.create({ name: 'A', prices: [ProductPrice.create({ name: 'A1' }), ProductPrice.create({ name: 'A2' })] }),
            Product.create({ name: 'B' }),
        ],
    });
}

describe('Webshop.orderMode', () => {
    it('falls back to the deprecated cartEnabled flag', () => {
        expect(createWebshop({ cartEnabled: true }).orderMode).toBe(WebshopOrderMode.Cart);
        expect(createWebshop({ cartEnabled: false }).orderMode).toBe(WebshopOrderMode.Single);
        expect(createWebshop({ cartEnabled: true }).shouldEnableCart).toBe(true);
        expect(createWebshop({ cartEnabled: false }).shouldEnableCart).toBe(false);
    });

    it('prefers an explicit order mode', () => {
        expect(createWebshop({ cartEnabled: true, orderMode: WebshopOrderMode.Bulk }).orderMode).toBe(WebshopOrderMode.Bulk);
        expect(createWebshop({ cartEnabled: false, orderMode: WebshopOrderMode.Cart }).orderMode).toBe(WebshopOrderMode.Cart);
        expect(createWebshop({ cartEnabled: true, orderMode: WebshopOrderMode.Bulk }).shouldEnableCart).toBe(false);
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
