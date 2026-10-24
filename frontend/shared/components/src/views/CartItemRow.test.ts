import type { RecordAnswer } from '@stamhoofd/structures';
import { Cart, CartItem, Customer, Product, RecordCategory, RecordChooseOneAnswer, RecordChoice, RecordSettings, RecordTextAnswer, RecordType, TranslatedString, Webshop } from '@stamhoofd/structures';
import { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { Formatter } from '@stamhoofd/utility';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import CartItemRow from './CartItemRow.vue';

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

    const screen = render(CartItemRow, {
        props: { cartItem, cart: Cart.create({ items: [cartItem] }), webshop },
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

    const details = screen.getByTestId('participant-details').element().textContent ?? '';
    expect(details.indexOf('Zwemniveau')).toBeGreaterThanOrEqual(0);
    expect(details.indexOf('Zwemniveau')).toBeLessThan(details.indexOf('Allergieën'));
});
