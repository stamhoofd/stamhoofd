import { Webshop, WebshopFactory } from '@stamhoofd/models';
import { Option, OptionMenu, Product, WebshopMetaData, WebshopOrderMode } from '@stamhoofd/structures';
import { upgradeWebshopOrderModes } from './1793027516-webshop-order-modes.js';

// Not unique: a choice keeps a webshop with only this product on a cart
function productWithChoice(name: string, allowMultiple: boolean | null) {
    return Product.create({
        name,
        allowMultiple,
        optionMenus: [OptionMenu.create({ name: 'Maaltijd', options: [Option.create({ name: 'Vlees' }), Option.create({ name: 'Vegetarisch' })] })],
    });
}

async function createWebshop(orderMode: WebshopOrderMode, products: Product[]) {
    return await new WebshopFactory({
        meta: WebshopMetaData.patch({ orderMode }),
        products,
    }).create();
}

async function reload(webshop: Webshop) {
    return (await Webshop.getByID(webshop.id))!;
}

describe('Seed.webshop-order-modes', () => {
    test('A cart with a single unique product orders one at a time, like it did automatically', async () => {
        const webshop = await createWebshop(WebshopOrderMode.Cart, [Product.create({ name: 'Inkom', allowMultiple: true })]);

        await upgradeWebshopOrderModes();

        const upgraded = await reload(webshop);
        expect(upgraded.meta.orderMode).toBe(WebshopOrderMode.Single);
        // The amount stays, like before
        expect(upgraded.products[0].allowMultiple).toBe(true);
    });

    test('Only keeps the values that differ from what the order mode does without one', async () => {
        const single = await createWebshop(WebshopOrderMode.Single, [
            Product.create({ name: 'Several', allowMultiple: true }),
            Product.create({ name: 'One', allowMultiple: false }),
            Product.create({ name: 'Automatic', allowMultiple: null }),
        ]);
        const cart = await createWebshop(WebshopOrderMode.Cart, [
            productWithChoice('Several', true),
            productWithChoice('One', false),
            productWithChoice('Automatic', null),
        ]);
        const bulk = await createWebshop(WebshopOrderMode.Bulk, [
            Product.create({ name: 'Several', allowMultiple: true }),
            Product.create({ name: 'One', allowMultiple: false }),
        ]);

        await upgradeWebshopOrderModes();

        expect((await reload(single)).products.map(p => p.allowMultiple)).toEqual([true, null, null]);

        const upgradedCart = await reload(cart);
        expect(upgradedCart.meta.orderMode).toBe(WebshopOrderMode.Cart);
        expect(upgradedCart.products.map(p => p.allowMultiple)).toEqual([null, false, null]);

        expect((await reload(bulk)).products.map(p => p.allowMultiple)).toEqual([null, false]);
    });
});
