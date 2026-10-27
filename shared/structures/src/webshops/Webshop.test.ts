import { describe, expect, it } from 'vitest';

import { Product, ProductPrice } from './Product.js';
import { PrivateWebshop, Webshop } from './Webshop.js';
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

/**
 * 424 makes Product.allowMultiple nullable: older clients get the value that follows from the order mode
 */
describe('Webshop.products 423 <-> 424', () => {
    function encodeAllowMultiple(webshop: Webshop, version: number) {
        return (webshop.encode({ version }) as { products: { allowMultiple: boolean | null }[] }).products.map(p => p.allowMultiple);
    }

    function createProducts() {
        return [
            Product.create({ name: 'Follows', allowMultiple: null }),
            Product.create({ name: 'Multiple', allowMultiple: true }),
            Product.create({ name: 'Unique', allowMultiple: false }),
        ];
    }

    it('sends the order mode of products without their own setting to an older client', () => {
        expect(encodeAllowMultiple(createWebshop({ orderMode: WebshopOrderMode.Single, products: createProducts() }), 423)).toEqual([false, true, false]);
        expect(encodeAllowMultiple(createWebshop({ orderMode: WebshopOrderMode.Cart, products: createProducts() }), 423)).toEqual([true, true, false]);
        expect(encodeAllowMultiple(createWebshop({ orderMode: WebshopOrderMode.Bulk, products: createProducts() }), 423)).toEqual([true, true, false]);
    });

    it('keeps null on 424 and leaves the products unchanged', () => {
        const webshop = createWebshop({ orderMode: WebshopOrderMode.Single, products: createProducts() });
        expect(encodeAllowMultiple(webshop, 424)).toEqual([null, true, false]);

        encodeAllowMultiple(webshop, 423);
        expect(webshop.products[0].allowMultiple).toBeNull();
    });

    it('sends a patch of the products to an older client unchanged', () => {
        const patch = PrivateWebshop.patch({});
        patch.products.addPut(Product.create({ name: 'Nieuw', allowMultiple: null }));
        expect(() => patch.encode({ version: 423 })).not.toThrow();
    });
});
