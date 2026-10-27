import { Country } from '@stamhoofd/types/Country';
import { describe, expect, it, vi } from 'vitest';

import { ValidatedAddress } from '../addresses/Address.js';
import type { I18n } from '../I18nInterface.js';
import { Gender } from '../members/Gender.js';
import { RecordTextAnswer } from '../members/records/RecordAnswer.js';
import { RecordCategory } from '../members/records/RecordCategory.js';
import { RecordSettings, RecordType } from '../members/records/RecordSettings.js';
import { TranslatedString } from '../TranslatedString.js';
import { User } from '../User.js';
import { OrganizationMetaData } from '../OrganizationMetaData.js';
import { Cart } from './Cart.js';
import { CartItem } from './CartItem.js';
import { Checkout } from './Checkout.js';
import { Customer } from './Customer.js';
import { CustomerFieldRequirement } from './CustomerFieldRequirement.js';
import { CustomerSettings } from './CustomerSettings.js';
import { CartReservedSeat } from '../SeatingPlan.js';
import { Product, ProductPrice } from './Product.js';
import { UitpasNumberAndPrice } from './UitpasNumberAndPrice.js';
import { Webshop } from './Webshop.js';
import { WebshopDeliveryMethod, WebshopMetaData } from './WebshopMetaData.js';

const i18n = { t: (key: string) => key } as unknown as I18n;
const organizationMeta = OrganizationMetaData.create({});

function createWebshop(asked: Partial<Record<'phone' | 'birthDay' | 'address' | 'gender', boolean>>) {
    const toRequirement = (enabled: boolean | undefined) => enabled ? CustomerFieldRequirement.Required : CustomerFieldRequirement.Disabled;

    return Webshop.create({
        meta: WebshopMetaData.create({
            customerSettings: CustomerSettings.create({
                email: CustomerFieldRequirement.Required,
                phone: toRequirement(asked.phone),
                birthDay: toRequirement(asked.birthDay),
                address: toRequirement(asked.address),
                gender: toRequirement(asked.gender),
            }),
        }),
    });
}

function createValidCustomer() {
    return Customer.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
    });
}

function createAddress() {
    return ValidatedAddress.create({
        street: 'Teststraat',
        number: '1',
        postalCode: '9000',
        city: 'Gent',
        country: Country.Belgium,
        cityId: 'city-1',
        parentCityId: null,
        provinceId: 'province-1',
    });
}

describe('Checkout.validateCustomer', () => {
    it('requires a birth day when the birth day is asked', () => {
        const webshop = createWebshop({ birthDay: true });
        const checkout = Checkout.create({ customer: createValidCustomer() });

        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, false)).toThrow(/birth day/i);

        checkout.customer.birthDay = new Date('2000-01-01');
        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, false)).not.toThrow();
    });

    it('does not require a birth day for admins', () => {
        const webshop = createWebshop({ birthDay: true });
        const checkout = Checkout.create({ customer: createValidCustomer() });

        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, true)).not.toThrow();
    });

    it('clears the birth day when it is not asked', () => {
        const webshop = createWebshop({ birthDay: false });
        const customer = createValidCustomer();
        customer.birthDay = new Date('2000-01-01');
        const checkout = Checkout.create({ customer });

        checkout.validateCustomer(webshop, organizationMeta, i18n, false);
        expect(checkout.customer.birthDay).toBeNull();
    });

    it('requires an address when the address is asked', () => {
        const webshop = createWebshop({ address: true });
        const checkout = Checkout.create({ customer: createValidCustomer() });

        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, false)).toThrow(/address/i);

        checkout.customer.address = createAddress();
        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, false)).not.toThrow();
    });

    it('clears the customer address when the address is not asked and there is no delivery address', () => {
        const webshop = createWebshop({ address: false });
        const customer = createValidCustomer();
        customer.address = createAddress();
        const checkout = Checkout.create({ customer });

        checkout.validateCustomer(webshop, organizationMeta, i18n, false);
        expect(checkout.customer.address).toBeNull();
    });

    it('resets the gender when the gender is not asked', () => {
        const webshop = createWebshop({ gender: false });
        const customer = createValidCustomer();
        customer.gender = Gender.Female;
        const checkout = Checkout.create({ customer });

        checkout.validateCustomer(webshop, organizationMeta, i18n, false);
        expect(checkout.customer.gender).toBe(Gender.Other);
    });

    it('keeps the gender when the gender is asked', () => {
        const webshop = createWebshop({ gender: true });
        const customer = createValidCustomer();
        customer.gender = Gender.Female;
        const checkout = Checkout.create({ customer });

        checkout.validateCustomer(webshop, organizationMeta, i18n, false);
        expect(checkout.customer.gender).toBe(Gender.Female);
    });
});

describe('Checkout customer questions', () => {
    const question = RecordSettings.create({
        name: TranslatedString.create('T-shirtmaat'),
        type: RecordType.Text,
        required: true,
    });

    function createWebshopWithQuestion() {
        const webshop = createWebshop({});
        webshop.meta.customerSettings.recordCategory = RecordCategory.create({
            name: TranslatedString.create('Extra vragen'),
            records: [question],
        });
        return webshop;
    }

    it('requires an answer to a required customer question', () => {
        const webshop = createWebshopWithQuestion();
        const checkout = Checkout.create({ customer: createValidCustomer() });

        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, false)).toThrow();

        checkout.recordAnswers.set(question.id, RecordTextAnswer.create({ settings: question, value: 'M' }));
        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, false)).not.toThrow();
    });

    it('lets an admin save an order without answers to the current questions', () => {
        const webshop = createWebshopWithQuestion();
        webshop.meta.recordCategories = [RecordCategory.create({
            name: TranslatedString.create('Stap'),
            records: [RecordSettings.create({ name: TranslatedString.create('Opmerking'), type: RecordType.Text, required: true })],
        })];
        const checkout = Checkout.create({ customer: createValidCustomer() });

        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, true)).not.toThrow();
        expect(() => checkout.validateRecordAnswers(webshop, true)).not.toThrow();
        expect(() => checkout.validateRecordAnswers(webshop)).toThrow();
    });

    it('keeps the answers to customer questions when cleaning up old answers', () => {
        const webshop = createWebshopWithQuestion();
        const checkout = Checkout.create({ customer: createValidCustomer() });
        checkout.recordAnswers.set(question.id, RecordTextAnswer.create({ settings: question, value: 'M' }));

        const unknown = RecordSettings.create({ name: TranslatedString.create('Oud'), type: RecordType.Text });
        checkout.recordAnswers.set(unknown.id, RecordTextAnswer.create({ settings: unknown, value: 'x' }));

        checkout.validateRecordAnswers(webshop);

        expect(checkout.recordAnswers.get(question.id)?.stringValue).toBe('M');
        expect(checkout.recordAnswers.has(unknown.id)).toBe(false);
    });
});

describe('Checkout contact person from a cart item', () => {
    function createParticipantItem(customer: Customer, settings: Partial<CustomerSettings> = {}) {
        const product = Product.create({
            name: 'Deelname',
            enableCustomer: true,
            customerSettings: CustomerSettings.create(settings),
        });
        return CartItem.create({ product, productPrice: product.prices[0], customer });
    }

    it('copies the collected details and leaves the other fields to be asked', () => {
        const item = createParticipantItem(Customer.create({ firstName: 'Jane', lastName: 'Doe', phone: '+32 470 00 00 00' }), {
            phone: CustomerFieldRequirement.Required,
        });
        const checkout = Checkout.create({ cart: Cart.create({ items: [item] }), customerCartItemId: item.id });

        expect(checkout.customerFieldsFromCartItem).toEqual(['name', 'phone']);

        checkout.syncCustomerFromCartItem();
        expect(checkout.customer.firstName).toBe('Jane');
        expect(checkout.customer.lastName).toBe('Doe');
        expect(checkout.customer.phone).toBe('+32 470 00 00 00');
        expect(checkout.customer.email).toBe('');
    });

    it('still asks an optional field that was left empty on the cart item', () => {
        const item = createParticipantItem(Customer.create({ firstName: 'Jane', lastName: 'Doe' }), {
            email: CustomerFieldRequirement.Optional,
            phone: CustomerFieldRequirement.Optional,
        });
        item.customer!.phone = '+32 470 00 00 00';
        const checkout = Checkout.create({ cart: Cart.create({ items: [item] }), customerCartItemId: item.id });

        expect(checkout.customerFieldsFromCartItem).toEqual(['name', 'phone']);
    });

    it('does not use a participant as contact person for a logged in user', () => {
        const item = createParticipantItem(Customer.create({ firstName: 'Jane', lastName: 'Doe', phone: '+32 470 00 00 00' }), {
            phone: CustomerFieldRequirement.Required,
        });
        const webshop = createWebshop({});
        // Chosen before logging in, with their details copied to the order
        const checkout = Checkout.create({ cart: Cart.create({ items: [item] }), customerCartItemId: item.id });
        checkout.syncCustomerFromCartItem();
        expect(checkout.customer.phone).toBe('+32 470 00 00 00');

        checkout.validateCustomer(webshop, organizationMeta, i18n, false, User.create({ firstName: 'Sarah', lastName: 'Janssens', email: 'sarah@example.com' }));
        expect(checkout.customerCartItemId).toBeNull();
        expect(checkout.customer.name).toBe('Sarah Janssens');
        expect(checkout.customer.phone).toBe('');
    });

    it('picks a new default contact person when the chosen cart item was removed', () => {
        const removed = createParticipantItem(Customer.create({ firstName: 'Jane', lastName: 'Doe', phone: '+32 470 00 00 00' }), {
            phone: CustomerFieldRequirement.Required,
        });
        const remaining = createParticipantItem(Customer.create({ firstName: 'Ann', lastName: 'Doe' }));
        const checkout = Checkout.create({ cart: Cart.create({ items: [removed, remaining] }), customerCartItemId: removed.id });
        checkout.syncCustomerFromCartItem();
        checkout.cart.items = [remaining];

        checkout.selectDefaultContactPerson();
        expect(checkout.customerCartItemId).toBe(remaining.id);
        expect(checkout.customer.name).toBe('Ann Doe');
        expect(checkout.customer.phone).toBe('');
    });

    it('keeps the order customer in sync with edits to the cart item', () => {
        const item = createParticipantItem(Customer.create({ firstName: 'Jane', lastName: 'Doe' }));
        const webshop = createWebshop({});
        const checkout = Checkout.create({ cart: Cart.create({ items: [item] }), customerCartItemId: item.id });
        checkout.customer.email = 'jane@example.com';

        checkout.validateCustomer(webshop, organizationMeta, i18n, false);
        expect(checkout.customer.name).toBe('Jane Doe');

        item.customer!.firstName = 'Janet';
        checkout.validateCustomer(webshop, organizationMeta, i18n, false);
        expect(checkout.customer.name).toBe('Janet Doe');
        expect(checkout.customer.email).toBe('jane@example.com');
    });

    it('leaves out participants under 16 and drops them as contact person', () => {
        // Late evening in Brussels: the day boundary must follow Brussels time, not the test machine
        vi.useFakeTimers({ now: new Date('2026-06-15T21:30:00Z') });
        try {
            // Birth days are stored as midnight Brussels time: 16 today, and 16 tomorrow
            const adult = createParticipantItem(Customer.create({ firstName: 'Jane', lastName: 'Doe', birthDay: new Date('2010-06-14T22:00:00Z') }));
            const child = createParticipantItem(Customer.create({ firstName: 'Kid', lastName: 'Doe', birthDay: new Date('2010-06-15T22:00:00Z') }));
            const unknownAge = createParticipantItem(Customer.create({ firstName: 'Ann', lastName: 'Doe' }));
            const checkout = Checkout.create({ cart: Cart.create({ items: [adult, child, unknownAge] }), customerCartItemId: child.id });

            expect(checkout.contactPersonCandidates).toEqual([adult, unknownAge]);

            checkout.syncCustomerFromCartItem();
            expect(checkout.customerCartItemId).toBeNull();
            expect(checkout.customer.firstName).toBe('');
        } finally {
            vi.useRealTimers();
        }
    });

    it('keeps the delivery address when the contact person also gave an address', () => {
        const deliveryAddress = createAddress();
        const participantAddress = ValidatedAddress.create({ ...createAddress(), street: 'Andere straat' });
        const item = createParticipantItem(Customer.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', address: participantAddress }), {
            email: CustomerFieldRequirement.Required,
            address: CustomerFieldRequirement.Required,
        });
        const checkout = Checkout.create({
            cart: Cart.create({ items: [item] }),
            customerCartItemId: item.id,
            checkoutMethod: WebshopDeliveryMethod.create({ countries: [deliveryAddress.country] }),
            address: deliveryAddress,
        });
        const webshop = createWebshop({ address: true });

        expect(checkout.customerFieldsFromCartItem).not.toContain('address');

        // Same order as Checkout.validate()
        checkout.validateDeliveryAddress(webshop, organizationMeta);
        checkout.validateCustomer(webshop, organizationMeta, i18n, false);

        expect(checkout.customer.address).toStrictEqual(deliveryAddress);
        expect(checkout.customer.name).toBe('Jane Doe');
    });

    it('preselects the first adult participant until something was chosen or filled in', () => {
        vi.useFakeTimers({ now: new Date('2026-06-15T10:00:00Z') });
        try {
            const teen = createParticipantItem(Customer.create({ firstName: 'Teen', lastName: 'Doe', birthDay: new Date('2009-06-14T22:00:00Z') }));
            const adult = createParticipantItem(Customer.create({ firstName: 'Jane', lastName: 'Doe', birthDay: new Date('2008-06-14T22:00:00Z') }));

            const checkout = Checkout.create({ cart: Cart.create({ items: [teen, adult] }) });
            checkout.selectDefaultContactPerson();
            // 17 is a candidate, but only adults are chosen without asking
            expect(checkout.contactPersonCandidates).toEqual([teen, adult]);
            expect(checkout.customerCartItemId).toBe(adult.id);
            expect(checkout.customer.name).toBe('Jane Doe');

            // Someone else was already filled in: keep that
            const other = Checkout.create({ cart: Cart.create({ items: [adult] }), customer: Customer.create({ firstName: 'John', lastName: 'Smith' }) });
            other.selectDefaultContactPerson();
            expect(other.customerCartItemId).toBeNull();
            expect(other.customer.name).toBe('John Smith');

            // Only a minor: nobody is chosen
            const minorOnly = Checkout.create({ cart: Cart.create({ items: [teen] }) });
            minorOnly.selectDefaultContactPerson();
            expect(minorOnly.customerCartItemId).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('forgets the contact person and their details when the cart item was removed', () => {
        const item = createParticipantItem(Customer.create({ firstName: 'Jane', lastName: 'Doe' }));
        const checkout = Checkout.create({ cart: Cart.create({ items: [item] }), customerCartItemId: item.id });
        checkout.syncCustomerFromCartItem();
        checkout.customer.email = 'jane@example.com';

        checkout.cart.removeItem(item);
        checkout.syncCustomerFromCartItem();

        expect(checkout.customerCartItemId).toBeNull();
        expect(checkout.customerFieldsFromCartItem).toEqual([]);
        // Everything filled in belonged to that participant
        expect(checkout.customer.name).toBe('');
        expect(checkout.customer.email).toBe('');
    });

    it('switches to the new participant when the cart item was replaced', () => {
        const simon = createParticipantItem(Customer.create({ firstName: 'Simon', lastName: 'Doe' }));
        const checkout = Checkout.create({ cart: Cart.create({ items: [simon] }) });
        checkout.selectDefaultContactPerson();
        expect(checkout.customer.name).toBe('Simon Doe');

        const jan = createParticipantItem(Customer.create({ firstName: 'Jan', lastName: 'Doe' }));
        checkout.cart.removeItem(simon);
        checkout.cart.addItem(jan);

        // Same order as when the customer step opens again
        checkout.syncCustomerFromCartItem();
        checkout.selectDefaultContactPerson();

        expect(checkout.customerCartItemId).toBe(jan.id);
        expect(checkout.customer.name).toBe('Jan Doe');
    });

    it('clears the details of the previous contact person when another participant is chosen', () => {
        const jane = createParticipantItem(Customer.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }), {
            email: CustomerFieldRequirement.Required,
        });
        const john = createParticipantItem(Customer.create({ firstName: 'John', lastName: 'Doe' }));
        const checkout = Checkout.create({ cart: Cart.create({ items: [jane, john] }) });
        checkout.setContactPerson(jane.id);
        // Filled in for the order itself
        checkout.customer.phone = '+32 470 00 00 00';

        checkout.setContactPerson(john.id);
        expect(checkout.customer.name).toBe('John Doe');
        // John's product doesn't collect an email address: Jane's must not stay behind
        expect(checkout.customer.email).toBe('');
        expect(checkout.customer.phone).toBe('+32 470 00 00 00');

        checkout.setContactPerson(null);
        expect(checkout.customerCartItemId).toBeNull();
        expect(checkout.customer.name).toBe('');
        expect(checkout.customer.phone).toBe('+32 470 00 00 00');
    });
});

describe('Checkout.validateDeliveryAddress', () => {
    it('copies the delivery address to the customer even when the address is not asked', () => {
        const address = createAddress();
        const checkoutMethod = WebshopDeliveryMethod.create({
            countries: [address.country],
        });
        const webshop = createWebshop({ address: false });
        const checkout = Checkout.create({
            customer: createValidCustomer(),
            checkoutMethod,
            address,
            cart: Cart.create({}),
        });

        checkout.validateDeliveryAddress(webshop, organizationMeta);
        expect(checkout.customer.address).toStrictEqual(address);
    });

    it('keeps the delivery address as the customer address when the address is asked and does not re-require it', () => {
        // validateCustomer relies on validateDeliveryAddress having run first: the delivery
        // address is copied onto the customer, so the addressEnabled check must not throw even
        // though the customer never filled in a separate address.
        const address = createAddress();
        const checkoutMethod = WebshopDeliveryMethod.create({
            countries: [address.country],
        });
        const webshop = createWebshop({ address: true });
        const checkout = Checkout.create({
            customer: createValidCustomer(),
            checkoutMethod,
            address,
            cart: Cart.create({}),
        });

        // Same order as Checkout.validate()
        checkout.validateDeliveryAddress(webshop, organizationMeta);
        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, false)).not.toThrow();
        expect(checkout.customer.address).toStrictEqual(address);
    });
});

describe('Checkout.validateCustomer with an account', () => {
    it('uses the name of the account, unless the account has no full name', () => {
        const webshop = createWebshop({});

        const full = Checkout.create({ customer: createValidCustomer() });
        full.validateCustomer(webshop, organizationMeta, i18n, false, User.create({ firstName: 'Jan', lastName: 'Peeters', email: 'jan@example.com' }));
        expect([full.customer.firstName, full.customer.lastName, full.customer.email]).toEqual(['Jan', 'Peeters', 'jan@example.com']);

        // The name filled in during the checkout stays
        const incomplete = Checkout.create({ customer: createValidCustomer() });
        incomplete.validateCustomer(webshop, organizationMeta, i18n, false, User.create({ firstName: 'Jan', email: 'jan@example.com' }));
        expect([incomplete.customer.firstName, incomplete.customer.lastName, incomplete.customer.email]).toEqual(['John', 'Doe', 'jan@example.com']);
    });
});

describe('Checkout.withGroupedItems', () => {
    function unit(product: Product, { seat, uitpasNumber, price }: { seat?: string; uitpasNumber?: string; price?: ProductPrice } = {}) {
        return CartItem.create({
            product,
            productPrice: price ?? product.prices[0],
            amount: 1,
            seats: seat ? [CartReservedSeat.create({ section: 'zaal', row: 'A', seat })] : [],
            uitpasNumbers: uitpasNumber ? [UitpasNumberAndPrice.create({ uitpasNumber, price: 5_0000 })] : [],
        });
    }

    it('combines the units of a product, keeping their seats and UiTPAS numbers in order', () => {
        const product = Product.create({ name: 'Voorstelling', prices: [ProductPrice.create({ price: 10_0000 })] });
        const webshop = Webshop.create({ products: [product] });
        const checkout = Checkout.create({ cart: Cart.create({ items: [unit(product, { seat: '1', uitpasNumber: '111' }), unit(product, { seat: '2', uitpasNumber: '222' })] }) });

        const grouped = checkout.withGroupedItems(webshop);

        expect(grouped.cart.items).toHaveLength(1);
        expect(grouped.cart.items[0].amount).toBe(2);
        expect(grouped.cart.items[0].seats.map(s => s.seat)).toEqual(['1', '2']);
        expect(grouped.cart.items[0].uitpasNumbers.map(u => u.uitpasNumber)).toEqual(['111', '222']);

        // The cart of the checkout itself keeps a unit per item
        expect(checkout.cart.items).toHaveLength(2);
    });

    it('keeps the same total price, also with a discount for buying several', () => {
        const product = Product.create({ name: 'Spaghetti', prices: [ProductPrice.create({ price: 10_0000, discountPrice: 8_0000, discountAmount: 2 })] });
        const webshop = Webshop.create({ products: [product] });
        const checkout = Checkout.create({ cart: Cart.create({ items: [unit(product), unit(product), unit(product)] }) });
        checkout.update(webshop);

        const grouped = checkout.withGroupedItems(webshop);
        expect(grouped.totalPrice).toBe(checkout.totalPrice);
        expect(grouped.totalPrice).toBe(3 * 8_0000);
    });

    it('keeps units with a different chosen price apart', () => {
        const price = ProductPrice.create({ price: 10_0000, allowCustomPrice: true });
        const product = Product.create({ name: 'Steun', prices: [price] });
        const webshop = Webshop.create({ products: [product] });
        const checkout = Checkout.create({ cart: Cart.create({ items: [
            unit(product, { price: price.patch({ price: 10_0000 }) }),
            unit(product, { price: price.patch({ price: 20_0000 }) }),
        ] }) });

        expect(checkout.withGroupedItems(webshop).cart.items.map(i => i.amount)).toEqual([1, 1]);
    });
});
