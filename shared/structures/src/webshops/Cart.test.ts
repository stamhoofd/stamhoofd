import { describe, expect, it } from 'vitest';

import { Cart } from './Cart.js';
import { CartItem } from './CartItem.js';
import { CartReservedSeat, SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection } from '../SeatingPlan.js';
import { Option, OptionMenu, Product, ProductPrice } from './Product.js';
import { UitpasNumberAndPrice } from './UitpasNumberAndPrice.js';
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

    it('keeps all items in Bulk mode, also for the same product', () => {
        const { webshop, productA, productB } = createWebshop(WebshopOrderMode.Bulk);
        const cart = Cart.create({ items: [item(productA), item(productA), item(productB, 2)] });

        cart.validate(webshop);
        expect(cart.items).toHaveLength(3);
    });

    it('keeps the units that are still in stock in Bulk mode', () => {
        const product = Product.create({ name: 'Workshop', stock: 2 });
        const webshop = Webshop.create({
            meta: WebshopMetaData.create({ orderMode: WebshopOrderMode.Bulk }),
            products: [product],
        });
        const units = [item(product), item(product), item(product)];
        const cart = Cart.create({ items: units });

        expect(() => cart.validate(webshop)).toThrow();
        expect(cart.items.map(i => i.id)).toEqual([units[0].id, units[1].id]);
    });

    it('validates one unit against the units before it', () => {
        const product = Product.create({ name: 'Workshop', stock: 2 });
        const webshop = Webshop.create({
            meta: WebshopMetaData.create({ orderMode: WebshopOrderMode.Bulk }),
            products: [product],
        });
        const units = [item(product), item(product), item(product)];
        const cart = Cart.create({ items: units });

        expect(() => cart.validateItem(webshop, units[1])).not.toThrow();
        expect(() => cart.validateItem(webshop, units[2])).toThrow();
    });

    it('rejects the same UiTPAS number on units that are combined in the order', () => {
        const basePrice = ProductPrice.create({ name: 'Normaal', price: 10_0000 });
        const uitpasPrice = ProductPrice.create({ name: 'UiTPAS kansentarief', price: 2_0000, uitpasBaseProductPriceId: basePrice.id });
        const product = Product.create({ name: 'Voorstelling', prices: [basePrice, uitpasPrice] });
        const webshop = Webshop.create({
            meta: WebshopMetaData.create({ orderMode: WebshopOrderMode.Bulk }),
            products: [product],
        });
        const unit = (uitpasNumber: string) => CartItem.create({
            product,
            productPrice: uitpasPrice,
            uitpasNumbers: [UitpasNumberAndPrice.create({ uitpasNumber, price: uitpasPrice.price })],
        });

        expect(() => Cart.create({ items: [unit('0900000095902'), unit('0900000095903')] }).validate(webshop)).not.toThrow();

        const cart = Cart.create({ items: [unit('0900000095902'), unit('0900000095902')] });
        expect(() => cart.validateItem(webshop, cart.items[1])).not.toThrow();
        expect(() => cart.validate(webshop)).toThrow(expect.objectContaining({ code: 'duplicate_uitpas_numbers' }));
    });
});

describe('Cart.splitIntoUnits', () => {
    it('splits items with an amount into one item per unit', () => {
        const { productA, productB } = createWebshop(WebshopOrderMode.Bulk);
        const multiple = item(productA, 3);
        const single = item(productB);
        const cart = Cart.create({ items: [multiple, single] });

        cart.splitIntoUnits();
        expect(cart.items.map(i => i.amount)).toEqual([1, 1, 1, 1]);
        expect(cart.items.map(i => i.product.id)).toEqual([productA.id, productA.id, productA.id, productB.id]);
        expect(new Set(cart.items.map(i => i.id)).size).toBe(4);
        expect(cart.items[0].id).toBe(multiple.id);
        expect(cart.items[3]).toBe(single);
    });
});

describe('Cart.grouped', () => {
    it('combines the units with the same code into one item, without changing the cart', () => {
        const { productA, productB } = createWebshop(WebshopOrderMode.Bulk);
        const cart = Cart.create({ items: [item(productA), item(productB), item(productA), item(productA)] });

        const grouped = cart.grouped();
        expect(grouped.items.map(i => [i.product.id, i.amount])).toEqual([[productA.id, 3], [productB.id, 1]]);
        expect(cart.items).toHaveLength(4);
        expect(cart.items.every(i => i.amount === 1)).toBe(true);
    });

    it('combines the units of a split item again with their seats, e.g. after switching from bulk mode to a cart', () => {
        const { productA } = createWebshop(WebshopOrderMode.Bulk);
        const seated = item(productA, 2);
        seated.seats = [CartReservedSeat.create({ row: 'A', seat: '1' }), CartReservedSeat.create({ row: 'A', seat: '2' })];
        const cart = Cart.create({ items: [seated] });

        cart.splitIntoUnits();
        const grouped = cart.grouped();
        expect(grouped.items).toHaveLength(1);
        expect(grouped.items[0].amount).toBe(2);
        expect(grouped.items[0].seats.map(s => s.row + s.seat)).toEqual(['A1', 'A2']);
    });

    it('keeps the units with a participant of their own apart', () => {
        const product = Product.create({ name: 'Kamp', enableCustomer: true });
        const cart = Cart.create({ items: [item(product), item(product)] });

        expect(cart.grouped().items.map(i => i.amount)).toEqual([1, 1]);
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

describe('Cart.validate with seats', () => {
    it('keeps the seats of units of the same product that were chosen right to left', () => {
        const seatingPlan = SeatingPlan.create({
            name: 'Zaal',
            requireOptimalReservation: true,
            sections: [SeatingPlanSection.create({ rows: [SeatingPlanRow.create({ label: 'A', seats: ['1', '2', '3', '4', '5', '6'].map(label => SeatingPlanSeat.create({ label })) })] })],
        });
        const section = seatingPlan.sections[0].id;
        const product = Product.create({ name: 'Voorstelling', seatingPlanId: seatingPlan.id });
        const webshop = Webshop.create({
            meta: WebshopMetaData.create({ orderMode: WebshopOrderMode.Bulk, seatingPlans: [seatingPlan] }),
            products: [product],
        });
        const unit = (seat: string) => CartItem.create({ product, productPrice: product.prices[0], seats: [CartReservedSeat.create({ section, row: 'A', seat })] });
        const cart = Cart.create({ items: [unit('2'), unit('1')] });

        cart.validate(webshop);
        expect(cart.items.map(i => i.seats.map(s => s.seat))).toEqual([['2'], ['1']]);
    });
});

describe('Cart.validate without details validation', () => {
    it('keeps items without options, fields and customer when validateDetails is false', () => {
        const optionMenu = OptionMenu.create({ name: 'Maaltijd', multipleChoice: false, autoSelectFirst: false, options: [Option.create({ name: 'A' })] });
        const product = Product.create({
            name: 'Workshop',
            optionMenus: [optionMenu],
            customFields: [WebshopField.create({ name: 'Naam', required: true })],
            enableCustomer: true,
        });
        const webshop = Webshop.create({ meta: WebshopMetaData.create({ orderMode: WebshopOrderMode.Bulk }), products: [product] });
        const cart = Cart.create({ items: [CartItem.create({ product, productPrice: product.prices[0] })] });

        expect(() => cart.validate(webshop, false, { validateDetails: false })).not.toThrow();
        expect(cart.items).toHaveLength(1);
        expect(() => cart.validate(webshop)).toThrow();
    });
});
