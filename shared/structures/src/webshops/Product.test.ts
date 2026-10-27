import { ObjectData } from '@common/encoding';
import { describe, expect, it } from 'vitest';

import { Product } from './Product.js';

function encode(product: Product | ReturnType<typeof Product.patch>, version: number) {
    return product.encode({ version }) as Record<string, unknown>;
}

function decode(data: Record<string, unknown>, version: number) {
    return Product.decode(new ObjectData({ ...encode(Product.create({}), version), ...data }, { version }));
}

function decodePatch(data: Record<string, unknown>, version: number) {
    return Product.patchType().decode(new ObjectData(data, { version }));
}

/**
 * 424 makes allowMultiple nullable: null follows the order mode of the webshop (see Webshop.allowsMultiple)
 */
describe('Product.allowMultiple 423 <-> 424', () => {
    const before = 423;
    const after = 424;

    it('keeps the value of an older client as a setting of its own', () => {
        expect(decode({ allowMultiple: true }, before).allowMultiple).toBe(true);
        expect(decode({ allowMultiple: false }, before).allowMultiple).toBe(false);
    });

    it('keeps null on 424', () => {
        expect(decode({ allowMultiple: null }, after).allowMultiple).toBeNull();
    });

    it('sends null as the old default to an older client', () => {
        expect(encode(Product.create({ allowMultiple: null }), before).allowMultiple).toBe(true);
        expect(encode(Product.create({ allowMultiple: false }), before).allowMultiple).toBe(false);
    });

    it('upgrades and downgrades patches', () => {
        const product = Product.create({ allowMultiple: null });
        expect(product.patch(decodePatch({ id: product.id, allowMultiple: false }, before)).allowMultiple).toBe(false);
        expect(product.patch(decodePatch({ id: product.id, name: 'Nieuwe naam' }, before)).allowMultiple).toBeNull();

        expect(encode(Product.patch({ id: product.id, allowMultiple: null }), before).allowMultiple).toBe(true);
        expect(encode(Product.patch({ id: product.id, name: 'Nieuwe naam' }), before).allowMultiple).toBeUndefined();
    });
});
