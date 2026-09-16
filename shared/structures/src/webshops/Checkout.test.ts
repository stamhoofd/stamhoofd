import { Country } from '@stamhoofd/types/Country';
import { describe, expect, it } from 'vitest';

import { ValidatedAddress } from '../addresses/Address.js';
import type { I18n } from '../I18nInterface.js';
import { Gender } from '../members/Gender.js';
import { OrganizationMetaData } from '../OrganizationMetaData.js';
import { Cart } from './Cart.js';
import { Checkout } from './Checkout.js';
import { Customer } from './Customer.js';
import { CustomerFieldRequirement } from './CustomerFieldRequirement.js';
import { CustomerSettings } from './CustomerSettings.js';
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
