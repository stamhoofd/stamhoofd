import { TranslatedString } from '../TranslatedString.js';
import { RecordTextAnswer } from '../members/records/RecordAnswer.js';
import { RecordCategory } from '../members/records/RecordCategory.js';
import { RecordSettings, RecordType } from '../members/records/RecordSettings.js';
import { Cart } from './Cart.js';
import { Customer } from './Customer.js';
import { CustomerFieldRequirement } from './CustomerFieldRequirement.js';
import { ProductCustomerSettings } from './ProductCustomerSettings.js';
import { CartItem, CartItemOption } from './CartItem.js';
import { Option, OptionMenu, Product, ProductPrice } from './Product.js';
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

    describe('refresh with allowCustomPrice', () => {
        const suggestedPrice = 5_00_00;

        function buildWebshop({ allowCustomPrice }: { allowCustomPrice: boolean }) {
            const productPrice = ProductPrice.create({
                name: 'Support us',
                price: suggestedPrice,
                allowCustomPrice,
            });
            const product = Product.create({
                name: 'Donation',
                prices: [productPrice],
            });
            const webshop = Webshop.create({
                products: [product],
            });
            return { webshop, product, productPrice };
        }

        function buildCartItem(product: Product, price: number) {
            const cartItem = CartItem.create({
                product,
                productPrice: product.prices[0].clone(),
            });
            cartItem.productPrice.price = price;
            return cartItem;
        }

        it('keeps the chosen price and does not mutate the webshop structure', () => {
            const { webshop, product, productPrice } = buildWebshop({ allowCustomPrice: true });
            const cartItem = buildCartItem(product, 10_00_00);

            cartItem.refresh(webshop);

            expect(cartItem.productPrice.price).toBe(10_00_00);
            expect(cartItem.productPrice).not.toBe(productPrice);
            expect(productPrice.price).toBe(suggestedPrice);
        });

        it('keeps the boundary values', () => {
            const { webshop, product } = buildWebshop({ allowCustomPrice: true });

            const minimumItem = buildCartItem(product, ProductPrice.customPriceMinimum);
            minimumItem.refresh(webshop);
            expect(minimumItem.productPrice.price).toBe(ProductPrice.customPriceMinimum);

            const maximumItem = buildCartItem(product, ProductPrice.customPriceMaximum);
            maximumItem.refresh(webshop);
            expect(maximumItem.productPrice.price).toBe(ProductPrice.customPriceMaximum);
        });

        it('rounds the chosen price to whole cents', () => {
            const { webshop, product } = buildWebshop({ allowCustomPrice: true });
            const cartItem = buildCartItem(product, 10_00_49);

            cartItem.refresh(webshop);

            expect(cartItem.productPrice.price).toBe(10_00_00);
        });

        it('clamps a price below the minimum to the minimum', () => {
            const { webshop, product } = buildWebshop({ allowCustomPrice: true });
            const cartItem = buildCartItem(product, 50_00);

            cartItem.refresh(webshop);

            expect(cartItem.productPrice.price).toBe(ProductPrice.customPriceMinimum);
        });

        it('clamps a price above the maximum to the maximum', () => {
            const { webshop, product } = buildWebshop({ allowCustomPrice: true });
            const cartItem = buildCartItem(product, ProductPrice.customPriceMaximum + 1_00);

            cartItem.refresh(webshop);

            expect(cartItem.productPrice.price).toBe(ProductPrice.customPriceMaximum);
        });

        it('ignores a tampered price when allowCustomPrice is disabled', () => {
            const { webshop, product } = buildWebshop({ allowCustomPrice: false });
            const cartItem = buildCartItem(product, 1_00);

            cartItem.refresh(webshop);

            expect(cartItem.productPrice.price).toBe(suggestedPrice);
        });

        it('createDefault clones the product price so edits do not mutate the webshop structure', () => {
            const { webshop, product, productPrice } = buildWebshop({ allowCustomPrice: true });
            const cartItem = CartItem.createDefault(product, Cart.create({}), webshop, { admin: false });

            expect(cartItem.productPrice).not.toBe(productPrice);
            cartItem.productPrice.price = 20_00_00;
            expect(productPrice.price).toBe(suggestedPrice);
        });

        it('does not merge cart items with a different custom price', () => {
            const { product } = buildWebshop({ allowCustomPrice: true });
            const cart = Cart.create({});

            cart.addItem(buildCartItem(product, 20_00_00));
            cart.addItem(buildCartItem(product, 5_00_00));

            expect(cart.items).toHaveLength(2);
            expect(cart.items.map(i => i.productPrice.price)).toEqual([20_00_00, 5_00_00]);
        });

        it('merges cart items with the same custom price', () => {
            const { product } = buildWebshop({ allowCustomPrice: true });
            const cart = Cart.create({});

            cart.addItem(buildCartItem(product, 20_00_00));
            cart.addItem(buildCartItem(product, 20_00_00));

            expect(cart.items).toHaveLength(1);
            expect(cart.items[0].amount).toBe(2);
            expect(cart.items[0].productPrice.price).toBe(20_00_00);
        });
    });

    describe('per-item customer', () => {
        function buildWebshop(settings?: Partial<ProductCustomerSettings>) {
            const product = Product.create({
                name: 'Ticket',
                enableCustomer: true,
                customerSettings: settings ? ProductCustomerSettings.create(settings) : null,
            });
            const webshop = Webshop.create({ products: [product] });
            return { webshop, product };
        }

        function buildCartItem(product: Product, customer: Customer | null, amount = 1) {
            return CartItem.create({ product, productPrice: product.prices[0], amount, customer });
        }

        it('requires a customer with a name and forces amount 1', () => {
            const { webshop, product } = buildWebshop();
            const cart = Cart.create({});

            expect(() => buildCartItem(product, null).validate(webshop, cart)).toThrow(/customer/i);
            expect(() => buildCartItem(product, Customer.create({ firstName: 'J', lastName: 'Doe' })).validate(webshop, cart)).toThrow(/first name/i);

            const item = buildCartItem(product, Customer.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com' }), 3);
            item.validate(webshop, cart);
            expect(item.amount).toBe(1);
            // Email is disabled by default: only the name is kept
            expect(item.customer!.email).toBe('');
        });

        it('applies the product customer settings', () => {
            const { webshop, product } = buildWebshop({ email: CustomerFieldRequirement.Required });
            const cart = Cart.create({});

            expect(() => buildCartItem(product, Customer.create({ firstName: 'John', lastName: 'Doe' })).validate(webshop, cart)).toThrow(/email/i);
            expect(() => buildCartItem(product, Customer.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com' })).validate(webshop, cart)).not.toThrow();
        });

        it('validates the inline record category', () => {
            const record = RecordSettings.create({ name: TranslatedString.create('Allergieën'), type: RecordType.Text, required: true });
            const { webshop, product } = buildWebshop({ recordCategory: RecordCategory.create({ name: TranslatedString.create('Extra'), records: [record] }) });
            const cart = Cart.create({});
            const item = buildCartItem(product, Customer.create({ firstName: 'John', lastName: 'Doe' }));

            expect(() => item.validate(webshop, cart)).toThrow();

            item.recordAnswers.set(record.id, RecordTextAnswer.create({ settings: record, value: 'Noten' }));
            expect(() => item.validate(webshop, cart)).not.toThrow();
        });

        it('clears the customer when the product does not collect one', () => {
            const product = Product.create({ name: 'Ticket' });
            const webshop = Webshop.create({ products: [product] });
            const item = buildCartItem(product, Customer.create({ firstName: 'John', lastName: 'Doe' }), 2);

            item.validate(webshop, Cart.create({}));
            expect(item.customer).toBeNull();
            expect(item.amount).toBe(2);
        });

        it('never merges people into one cart item, and keeps the customer out of the product code used for totals', () => {
            const { product } = buildWebshop();
            const cart = Cart.create({});
            const john = buildCartItem(product, Customer.create({ firstName: 'John', lastName: 'Doe' }));
            cart.addItem(john);
            cart.addItem(buildCartItem(product, Customer.create({ firstName: 'Jane', lastName: 'Doe' })));
            // Same name twice: still two people
            cart.addItem(buildCartItem(product, Customer.create({ firstName: 'John', lastName: 'Doe' })));

            expect(cart.items).toHaveLength(3);
            expect(cart.items.every(i => i.amount === 1)).toBe(true);
            expect(cart.items[1].codeWithoutFields).toBe(john.codeWithoutFields);
            expect(product.isUnique).toBe(false);
        });
    });
});
