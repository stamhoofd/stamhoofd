import { describe, expect, it } from 'vitest';

import { Cart } from './Cart.js';
import { CartItem } from './CartItem.js';
import { Checkout } from './Checkout.js';
import { Discount, ProductDiscount, ProductDiscountSettings, ProductSelector, ProductsSelector } from './Discount.js';
import { Product, ProductPrice } from './Product.js';
import { Webshop } from './Webshop.js';
import { WebshopMetaData } from './WebshopMetaData.js';

const smallPrice = ProductPrice.create({ name: 'Klein', price: 10_00_00 });
const largePrice = ProductPrice.create({ name: 'Groot', price: 20_00_00 });

function createProduct() {
    return Product.create({
        name: 'T-shirt',
        prices: [smallPrice, largePrice],
    });
}

/**
 * A discount of 50% on the product, limited to the product prices in productPriceIds
 */
function createWebshop(product: Product, productPriceIds: string[]) {
    return Webshop.create({
        products: [product],
        meta: WebshopMetaData.create({
            defaultDiscounts: [
                Discount.create({
                    productDiscounts: [
                        ProductDiscountSettings.create({
                            product: ProductsSelector.create({
                                products: [
                                    ProductSelector.create({
                                        productId: product.id,
                                        productPriceIds,
                                    }),
                                ],
                            }),
                            discounts: [
                                ProductDiscount.create({
                                    percentageDiscount: 50_00,
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        }),
    });
}

function createCheckout(webshop: Webshop, product: Product, productPrice: ProductPrice) {
    const checkout = Checkout.create({
        cart: Cart.create({
            items: [
                CartItem.create({
                    product,
                    productPrice,
                    amount: 1,
                }),
            ],
        }),
    });
    checkout.update(webshop);
    return checkout;
}

describe('ProductSelector.doesMatch', () => {
    it('matches every product price when productPriceIds is empty', () => {
        const product = createProduct();
        const selector = ProductSelector.create({ productId: product.id });

        expect(selector.doesMatch(CartItem.create({ product, productPrice: smallPrice }))).toBe(true);
        expect(selector.doesMatch(CartItem.create({ product, productPrice: largePrice }))).toBe(true);
    });

    it('only matches the selected product prices', () => {
        const product = createProduct();
        const selector = ProductSelector.create({
            productId: product.id,
            productPriceIds: [smallPrice.id],
        });

        expect(selector.doesMatch(CartItem.create({ product, productPrice: smallPrice }))).toBe(true);
        expect(selector.doesMatch(CartItem.create({ product, productPrice: largePrice }))).toBe(false);
    });

    it('does not match a different product', () => {
        const product = createProduct();
        const otherProduct = createProduct();
        const selector = ProductSelector.create({ productId: product.id });

        expect(selector.doesMatch(CartItem.create({ product: otherProduct, productPrice: smallPrice }))).toBe(false);
    });
});

describe('Discount.applyToCheckout', () => {
    it('applies a discount configured for a specific product price to that product price', () => {
        const product = createProduct();
        const webshop = createWebshop(product, [smallPrice.id]);
        const checkout = createCheckout(webshop, product, smallPrice);

        expect(checkout.cart.priceWithDiscounts).toBe(5_00_00);
    });

    it('does not apply a discount configured for a specific product price to other product prices', () => {
        const product = createProduct();
        const webshop = createWebshop(product, [smallPrice.id]);
        const checkout = createCheckout(webshop, product, largePrice);

        expect(checkout.cart.priceWithDiscounts).toBe(20_00_00);
    });

    it('applies a discount without product prices to all product prices', () => {
        const product = createProduct();
        const webshop = createWebshop(product, []);

        expect(createCheckout(webshop, product, smallPrice).cart.priceWithDiscounts).toBe(5_00_00);
        expect(createCheckout(webshop, product, largePrice).cart.priceWithDiscounts).toBe(10_00_00);
    });
});
