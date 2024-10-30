import { Cart } from './Cart.js';
import { CartItem, CartItemOption } from './CartItem.js';
import { Option, OptionMenu, Product } from './Product.js';
import { Webshop } from './Webshop.js';

describe('Structure.CartItem', () => {
    it('can contain multiple options for the same multiple choice menu', () => {
        const optionA = Option.create({ name: 'A' });
        const optionB = Option.create({ name: 'B' });
        const optionMenu = OptionMenu.create({
            name: "Kies je extra's",
            multipleChoice: true,
            options: [optionA, optionB],
        });

        const product = Product.create({
            name: 'Test',
            optionMenus: [optionMenu],
        });

        const cartItem = CartItem.create({
            product: product,
            productPrice: product.prices[0],
            options: [
                CartItemOption.create({ optionMenu, option: optionA }),
                CartItemOption.create({ optionMenu, option: optionB }),
            ],
        });

        const webshop = Webshop.create({
            products: [product],
        });
        expect(() => cartItem.validate(webshop, Cart.create({}))).not.toThrow();
    });

    it('can not contain multiple options for the same multiple choice menu', () => {
        const optionA = Option.create({ name: 'A' });
        const optionB = Option.create({ name: 'B' });
        const optionMenu = OptionMenu.create({
            name: "Kies je extra's",
            multipleChoice: false,
            options: [optionA, optionB],
        });

        const product = Product.create({
            name: 'Test',
            optionMenus: [optionMenu],
        });

        const cartItem = CartItem.create({
            product: product,
            productPrice: product.prices[0],
            options: [
                CartItemOption.create({ optionMenu, option: optionA }),
                CartItemOption.create({ optionMenu, option: optionB }),
            ],
        });

        const webshop = Webshop.create({
            products: [product],
        });
        expect(() => cartItem.validate(webshop, Cart.create({}))).toThrow();
    });
});
