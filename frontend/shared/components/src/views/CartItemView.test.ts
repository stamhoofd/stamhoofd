import { CartItem, Checkout, Product, ProductPrice, Webshop, WebshopMetaData, WebshopOrderMode } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { reactive } from 'vue';
import CartItemView from './CartItemView.vue';

function renderCartItemView(props: InstanceType<typeof CartItemView>['$props']) {
    return render(CartItemView, {
        props,
        global: {
            provide: {
                reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_present: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_show: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_dismiss: vi.fn().mockResolvedValue(undefined),
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t ?? ((value: string) => value),
                    $isMobile: false,
                    $isIOS: false,
                    $isAndroid: false,
                    $context: null,
                    formatPrice: Formatter.price.bind(Formatter),
                    formatDate: Formatter.date.bind(Formatter),
                } as any,
            },
            directives: {
                tooltip: {},
                copyable: {},
            },
        },
    });
}

test('live editing stops saving when the item no longer changes, although saving recalculates its prices', async () => {
    const product = Product.create({
        name: 'Ticket',
        prices: [ProductPrice.create({ name: 'Volwassen', price: 1000 }), ProductPrice.create({ name: 'Kind', price: 500 })],
    });
    const webshop = Webshop.create({ products: [product], meta: WebshopMetaData.create({ orderMode: WebshopOrderMode.Single }) });

    // Like the webshop: a reactive checkout whose cart holds the item that is edited in place
    const checkout = reactive(Checkout.create({})) as Checkout;
    checkout.cart.addItem(CartItem.createDefault(product, checkout.cart, webshop, { admin: false }), false);
    const cartItem = checkout.cart.items[0];

    // Storing the cart recalculates the prices of its items, which mutates the edited item
    const liveSaveHandler = vi.fn(() => checkout.update(webshop));
    const warn = vi.spyOn(console, 'warn');

    renderCartItemView({ cartItem, oldItem: cartItem, checkout, webshop, saveHandler: vi.fn(), liveSaveHandler, embedded: true });
    // Mounting fills in defaults on the item, which is saved once as well
    await new Promise(resolve => setTimeout(resolve, 100));
    liveSaveHandler.mockClear();

    cartItem.amount = 3;
    await vi.waitFor(() => expect(liveSaveHandler).toHaveBeenCalled());
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(liveSaveHandler).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls.some(args => String(args[0]).includes('Maximum recursive updates'))).toBe(false);
});

test('live editing only stores UiTPAS numbers on the item while a UiTPAS price is selected', async () => {
    const basePrice = ProductPrice.create({ name: 'Volwassen', price: 1000 });
    const uitpasPrice = ProductPrice.create({ name: 'UiTPAS', price: 250, uitpasBaseProductPriceId: basePrice.id });
    const product = Product.create({ name: 'Ticket', prices: [basePrice, uitpasPrice] });
    const webshop = Webshop.create({ products: [product], meta: WebshopMetaData.create({ orderMode: WebshopOrderMode.Single }) });

    const checkout = reactive(Checkout.create({})) as Checkout;
    checkout.cart.addItem(CartItem.createDefault(product, checkout.cart, webshop, { admin: false }), false);
    const cartItem = checkout.cart.items[0];
    cartItem.amount = 2;

    renderCartItemView({ cartItem, oldItem: cartItem, checkout, webshop, saveHandler: vi.fn(), liveSaveHandler: vi.fn(), embedded: true });
    await new Promise(resolve => setTimeout(resolve, 100));

    // The cart is stored with this item and validated later on (e.g. when opening the checkout)
    expect(cartItem.uitpasNumbers).toHaveLength(0);
    expect(() => checkout.cart.validate(webshop)).not.toThrow();

    cartItem.productPrice = uitpasPrice.clone();
    await vi.waitFor(() => expect(cartItem.uitpasNumbers).toHaveLength(2));

    cartItem.productPrice = basePrice.clone();
    await vi.waitFor(() => expect(cartItem.uitpasNumbers).toHaveLength(0));
});
