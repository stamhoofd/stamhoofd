import { describe, expect, it } from 'vitest';

import { Cart } from './Cart.js';
import { CartItem } from './CartItem.js';
import { SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection } from '../SeatingPlan.js';
import { Option, OptionMenu, Product } from './Product.js';
import { WebshopField } from './WebshopField.js';
import { Webshop } from './Webshop.js';
import { WebshopMetaData, WebshopOrderMode } from './WebshopMetaData.js';

function createWebshop(orderMode: WebshopOrderMode) {
    const productA = Product.create({ name: 'A' });
    const productB = Product.create({ name: 'B' });
    const webshop = Webshop.create({
        meta: WebshopMetaData.create({ orderMode }),
        products: [productA, productB],
    });
    return { webshop, productA, productB };
}

function item(product: Product, amount = 1) {
    return CartItem.create({ product, productPrice: product.prices[0], amount });
}

describe('Cart.validate', () => {
    it('keeps all items in Cart mode', () => {
        const { webshop, productA, productB } = createWebshop(WebshopOrderMode.Cart);
        const cart = Cart.create({ items: [item(productA, 2), item(productB)] });

        cart.validate(webshop);
        expect(cart.items).toHaveLength(2);
    });

    it('only keeps the first item in Single mode', () => {
        const { webshop, productA, productB } = createWebshop(WebshopOrderMode.Single);
        const cart = Cart.create({ items: [item(productA), item(productB)] });

        cart.validate(webshop);
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0].product.id).toBe(productA.id);
    });

    it('keeps all amount-1 items in Bulk mode, also for the same product', () => {
        const { webshop, productA, productB } = createWebshop(WebshopOrderMode.Bulk);
        const cart = Cart.create({ items: [item(productA), item(productA), item(productB)] });

        cart.validate(webshop);
        expect(cart.items).toHaveLength(3);
    });

    it('rejects items with an amount other than 1 in Bulk mode', () => {
        const { webshop, productA } = createWebshop(WebshopOrderMode.Bulk);
        const cart = Cart.create({ items: [item(productA, 2)] });

        expect(() => cart.validate(webshop)).toThrow(/amount 1/);
        // Not recoverable: the item is dropped
        expect(cart.items).toHaveLength(0);
    });
});

describe('Cart.validate without seat validation', () => {
    it('keeps seated items without seats when validateSeats is false', () => {
        const seatingPlan = SeatingPlan.create({
            name: 'Zaal',
            sections: [SeatingPlanSection.create({ rows: [SeatingPlanRow.create({ label: 'A', seats: [SeatingPlanSeat.create({ label: '1' })] })] })],
        });
        const product = Product.create({ name: 'Seated', seatingPlanId: seatingPlan.id });
        const webshop = Webshop.create({
            meta: WebshopMetaData.create({ orderMode: WebshopOrderMode.Bulk, seatingPlans: [seatingPlan] }),
            products: [product],
        });
        const cart = Cart.create({ items: [CartItem.create({ product, productPrice: product.prices[0] })] });

        expect(() => cart.validate(webshop, false, { validateSeats: false })).not.toThrow();
        expect(() => cart.validate(webshop)).toThrow(/seats/i);
    });
});

describe('Cart.validate without details validation', () => {
    it('keeps items without options and fields when validateDetails is false', () => {
        const optionMenu = OptionMenu.create({ name: 'Maaltijd', multipleChoice: false, autoSelectFirst: false, options: [Option.create({ name: 'A' })] });
        const product = Product.create({
            name: 'Workshop',
            optionMenus: [optionMenu],
            customFields: [WebshopField.create({ name: 'Naam', required: true })],
        });
        const webshop = Webshop.create({ meta: WebshopMetaData.create({ orderMode: WebshopOrderMode.Bulk }), products: [product] });
        const cart = Cart.create({ items: [CartItem.create({ product, productPrice: product.prices[0] })] });

        expect(() => cart.validate(webshop, false, { validateDetails: false })).not.toThrow();
        expect(cart.items).toHaveLength(1);
        expect(() => cart.validate(webshop)).toThrow();
    });
});
