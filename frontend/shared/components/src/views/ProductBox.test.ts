import type { ComponentWithProperties } from '@browser/navigation';
import { CartItem, Checkout, Product, ProductPrice, Webshop, WebshopMetaData, WebshopOrderMode } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { ref } from 'vue';
import ProductBox from './ProductBox.vue';

function createBulkWebshop() {
    const product = Product.create({
        name: 'Ticket',
        prices: [ProductPrice.create({ name: 'Volwassen', price: 1000 }), ProductPrice.create({ name: 'Kind', price: 500 })],
    });
    const webshop = Webshop.create({ products: [product], meta: WebshopMetaData.create({ orderMode: WebshopOrderMode.Bulk }) });
    return { product, webshop };
}

/**
 * Renders the box inside a navigation controller that can be dismissed, so a click calls `show` with the item view.
 * Resolves to the item view that would be shown.
 */
async function clickProductBox(props: { admin: boolean; product: Product; webshop: Webshop; checkout: Checkout }) {
    const show = vi.fn().mockResolvedValue(undefined);
    const screen = render(ProductBox, {
        props: { ...props, saveHandler: vi.fn() },
        global: {
            provide: {
                reactive_navigation_can_dismiss: ref(true),
                reactive_navigation_show: ref(show),
                reactive_navigation_present: ref(vi.fn().mockResolvedValue(undefined)),
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t ?? ((value: string) => value),
                    $isMobile: false,
                    $context: null,
                    formatPrice: Formatter.price.bind(Formatter),
                    formatDate: Formatter.date.bind(Formatter),
                    formatDateTime: Formatter.dateTime.bind(Formatter),
                } as any,
            },
        },
    });

    await screen.getByTestId('product-box').click();
    await vi.waitFor(() => expect(show).toHaveBeenCalledTimes(1));

    // The item view is loaded asynchronously: resolve it to read its properties
    const loader = show.mock.calls[0][0].components[0] as ComponentWithProperties;
    const view = await (loader.properties.promise as () => Promise<ComponentWithProperties>)();
    return view.properties as { cartItem: CartItem; oldItem: CartItem | undefined };
}

test('an administrator adds a new item for a product that is already in the order without a cart', async () => {
    const { product, webshop } = createBulkWebshop();
    const checkout = Checkout.create({});
    checkout.cart.addItem(CartItem.create({ product, productPrice: product.prices[0], amount: 2 }), false);

    const view = await clickProductBox({ admin: true, product, webshop, checkout });

    expect(view.oldItem).toBeUndefined();
    expect(view.cartItem.id).not.toBe(checkout.cart.items[0].id);
});

test('a buyer edits the item of a product that is already in the order without a cart', async () => {
    const { product, webshop } = createBulkWebshop();
    const checkout = Checkout.create({});
    checkout.cart.addItem(CartItem.create({ product, productPrice: product.prices[0], amount: 2 }), false);

    const view = await clickProductBox({ admin: false, product, webshop, checkout });

    expect(view.oldItem?.id).toBe(checkout.cart.items[0].id);
});
