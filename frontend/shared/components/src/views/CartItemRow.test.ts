import type { RecordAnswer } from '@stamhoofd/structures';
import { Cart, CartItem, Checkout, Customer, Product, ProductPrice, RecordCategory, RecordChooseOneAnswer, RecordChoice, RecordSettings, RecordTextAnswer, RecordType, TranslatedString, Webshop } from '@stamhoofd/structures';
import { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { Formatter } from '@stamhoofd/utility';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import CartItemRow from './CartItemRow.vue';

function renderRow(props: { cartItem: CartItem; cart: Cart; webshop: Webshop }) {
    return render(CartItemRow, {
        props,
        global: {
            provide: {
                reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_present: vi.fn().mockResolvedValue(undefined),
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t ?? ((value: string) => value),
                    $isMobile: false,
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

function renderFirstItem(products: Product[]) {
    const webshop = Webshop.create({ products });
    const checkout = Checkout.create({});
    checkout.cart.addItem(CartItem.createDefault(products[0], checkout.cart, webshop, { admin: false }), false);
    checkout.update(webshop);
    return renderRow({ cartItem: checkout.cart.items[0], cart: checkout.cart, webshop });
}

test('lists the answers of a participant in the order of the questions', async () => {
    const choice = RecordChoice.create({ name: TranslatedString.create('Zwemt zonder hulp') });
    const swimming = RecordSettings.create({ name: TranslatedString.create('Zwemniveau'), type: RecordType.ChooseOne, choices: [choice] });
    const allergies = RecordSettings.create({ name: TranslatedString.create('Allergieën'), type: RecordType.Textarea, required: false });
    const product = Product.create({
        name: 'Sportkamp',
        enableCustomer: true,
        customerSettings: CustomerSettings.create({ recordCategory: RecordCategory.create({ name: TranslatedString.create('Extra vragen'), records: [swimming, allergies] }) }),
    });
    const webshop = Webshop.create({ products: [product] });

    // Stored answers can come back in any order
    const cartItem = CartItem.create({
        product,
        productPrice: product.prices[0],
        customer: Customer.create({ firstName: 'Lotte', lastName: 'Peeters' }),
        recordAnswers: new Map<string, RecordAnswer>([
            [allergies.id, RecordTextAnswer.create({ settings: allergies, value: 'Noten' })],
            [swimming.id, RecordChooseOneAnswer.create({ settings: swimming, selectedChoice: choice })],
        ]),
    });

    const screen = renderRow({ cartItem, cart: Cart.create({ items: [cartItem] }), webshop });

    const details = screen.getByTestId('participant-details').element().textContent ?? '';
    expect(details.indexOf('Zwemniveau')).toBeGreaterThanOrEqual(0);
    expect(details.indexOf('Zwemniveau')).toBeLessThan(details.indexOf('Allergieën'));
});

test('hides the price of an item in a webshop where everything is free', () => {
    const screen = renderFirstItem([Product.create({ name: 'Inschrijving', prices: [ProductPrice.create({ price: 0 })] })]);
    expect(screen.container.querySelector('.price')).toBeNull();
});

test('shows the price of a free item when the webshop also sells paid items', () => {
    const screen = renderFirstItem([
        Product.create({ name: 'Inschrijving', prices: [ProductPrice.create({ price: 0 })] }),
        Product.create({ name: 'T-shirt', prices: [ProductPrice.create({ price: 1500 })] }),
    ]);
    expect(screen.container.querySelector('.price')).not.toBeNull();
});

test('shows the price of a paid item', () => {
    const screen = renderFirstItem([Product.create({ name: 'T-shirt', prices: [ProductPrice.create({ price: 1500 })] })]);
    expect(screen.container.querySelector('.price')?.textContent).toContain('15');
});
