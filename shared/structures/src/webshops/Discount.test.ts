import { describe, expect, it } from 'vitest';

import { Cart } from './Cart.js';
import { CartItem, CartItemOption } from './CartItem.js';
import { Checkout } from './Checkout.js';
import { Discount, OptionSelectionRequirement, ProductDiscount, ProductDiscountSettings, ProductSelector, ProductsSelector } from './Discount.js';
import { Option, OptionMenu, Product, ProductPrice } from './Product.js';
import { Webshop } from './Webshop.js';
import { WebshopMetaData } from './WebshopMetaData.js';

function createProduct() {
    return Product.create({
        name: 'T-shirt',
        prices: [
            ProductPrice.create({ name: 'Klein', price: 10_00_00 }),
            ProductPrice.create({ name: 'Groot', price: 20_00_00 }),
        ],
    });
}

function createProductWithOptions(multipleChoice = true) {
    const optionMenu = OptionMenu.create({
        name: "Kies je extra's",
        multipleChoice,
        options: [
            Option.create({ name: 'Opdruk' }),
            Option.create({ name: 'Naam' }),
        ],
    });

    const product = Product.create({
        name: 'T-shirt',
        prices: [ProductPrice.create({ name: 'Klein', price: 10_00_00 })],
        optionMenus: [optionMenu],
    });

    return { product, optionMenu, optionA: optionMenu.options[0], optionB: optionMenu.options[1] };
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
        const [smallPrice, largePrice] = product.prices;
        const selector = ProductSelector.create({ productId: product.id });

        expect(selector.doesMatch(CartItem.create({ product, productPrice: smallPrice }))).toBe(true);
        expect(selector.doesMatch(CartItem.create({ product, productPrice: largePrice }))).toBe(true);
    });

    it('only matches the selected product prices', () => {
        const product = createProduct();
        const [smallPrice, largePrice] = product.prices;
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

        expect(selector.doesMatch(CartItem.create({ product: otherProduct, productPrice: otherProduct.prices[0] }))).toBe(false);
    });

    it('does not match a cart item that contains an excluded option', () => {
        const { product, optionMenu, optionA, optionB } = createProductWithOptions();
        const selector = ProductSelector.create({
            productId: product.id,
            optionIds: new Map([[optionA.id, OptionSelectionRequirement.Excluded]]),
        });

        const withExcludedOption = CartItem.create({
            product,
            productPrice: product.prices[0],
            options: [CartItemOption.create({ optionMenu, option: optionA })],
        });

        const withOtherOption = CartItem.create({
            product,
            productPrice: product.prices[0],
            options: [CartItemOption.create({ optionMenu, option: optionB })],
        });

        expect(selector.doesMatch(withExcludedOption)).toBe(false);
        expect(selector.doesMatch(withOtherOption)).toBe(true);
    });

    it('does not match a cart item that is missing a required option', () => {
        const { product, optionMenu, optionA, optionB } = createProductWithOptions();
        const selector = ProductSelector.create({
            productId: product.id,
            optionIds: new Map([[optionA.id, OptionSelectionRequirement.Required]]),
        });

        const withRequiredOption = CartItem.create({
            product,
            productPrice: product.prices[0],
            options: [CartItemOption.create({ optionMenu, option: optionA })],
        });

        const withoutRequiredOption = CartItem.create({
            product,
            productPrice: product.prices[0],
            options: [CartItemOption.create({ optionMenu, option: optionB })],
        });

        expect(selector.doesMatch(withRequiredOption)).toBe(true);
        expect(selector.doesMatch(withoutRequiredOption)).toBe(false);
    });
});

describe('ProductSelector.getOptionRequirement', () => {
    it('defaults to optional for options that are not listed in a multiple choice menu', () => {
        const { product, optionMenu, optionA, optionB } = createProductWithOptions();
        const selector = ProductSelector.create({
            productId: product.id,
            optionIds: new Map([[optionA.id, OptionSelectionRequirement.Excluded]]),
        });

        expect(selector.getOptionRequirement(optionMenu, optionB)).toBe(OptionSelectionRequirement.Optional);
    });

    it('defaults to optional in a choose one menu when all listed options are optional', () => {
        const { product, optionMenu, optionA, optionB } = createProductWithOptions(false);
        const selector = ProductSelector.create({
            productId: product.id,
            optionIds: new Map([[optionA.id, OptionSelectionRequirement.Optional]]),
        });

        expect(selector.getOptionRequirement(optionMenu, optionB)).toBe(OptionSelectionRequirement.Optional);
    });

    it('defaults to excluded in a choose one menu when another option is required', () => {
        const { product, optionMenu, optionA, optionB } = createProductWithOptions(false);
        const selector = ProductSelector.create({
            productId: product.id,
            optionIds: new Map([[optionA.id, OptionSelectionRequirement.Required]]),
        });

        expect(selector.getOptionRequirement(optionMenu, optionB)).toBe(OptionSelectionRequirement.Excluded);
    });

    it('matches a cart item with an unlisted option in a choose one menu of optional options', () => {
        const { product, optionMenu, optionA, optionB } = createProductWithOptions(false);
        const selector = ProductSelector.create({
            productId: product.id,
            optionIds: new Map([[optionA.id, OptionSelectionRequirement.Optional]]),
        });

        const cartItem = CartItem.create({
            product,
            productPrice: product.prices[0],
            options: [CartItemOption.create({ optionMenu, option: optionB })],
        });

        expect(selector.doesMatch(cartItem)).toBe(true);
    });
});

describe('Discount.applyToCheckout', () => {
    it('applies a discount configured for a specific product price to that product price', () => {
        const product = createProduct();
        const [smallPrice] = product.prices;
        const webshop = createWebshop(product, [smallPrice.id]);
        const checkout = createCheckout(webshop, product, smallPrice);

        expect(checkout.cart.priceWithDiscounts).toBe(5_00_00);
    });

    it('does not apply a discount configured for a specific product price to other product prices', () => {
        const product = createProduct();
        const [smallPrice, largePrice] = product.prices;
        const webshop = createWebshop(product, [smallPrice.id]);
        const checkout = createCheckout(webshop, product, largePrice);

        expect(checkout.cart.priceWithDiscounts).toBe(20_00_00);
    });

    it('applies a discount without product prices to all product prices', () => {
        const product = createProduct();
        const [smallPrice, largePrice] = product.prices;
        const webshop = createWebshop(product, []);

        expect(createCheckout(webshop, product, smallPrice).cart.priceWithDiscounts).toBe(5_00_00);
        expect(createCheckout(webshop, product, largePrice).cart.priceWithDiscounts).toBe(10_00_00);
    });
});
