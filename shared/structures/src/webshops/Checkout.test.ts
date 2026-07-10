import { Country } from '@stamhoofd/types/Country';
import { describe, expect, it } from 'vitest';

import { ValidatedAddress } from '../addresses/Address.js';
import type { I18n } from '../I18nInterface.js';
import { Gender } from '../members/Gender.js';
import { OrganizationMetaData } from '../OrganizationMetaData.js';
import { Cart } from './Cart.js';
import { Checkout } from './Checkout.js';
import { Customer } from './Customer.js';
import { Webshop } from './Webshop.js';
import { WebshopDeliveryMethod, WebshopMetaData } from './WebshopMetaData.js';

const i18n = { t: (key: string) => key } as unknown as I18n;
const organizationMeta = OrganizationMetaData.create({});

function createWebshop(meta: Partial<Record<'phoneEnabled' | 'birthDayEnabled' | 'addressEnabled' | 'genderEnabled', boolean>>) {
    return Webshop.create({
        meta: WebshopMetaData.create({
            phoneEnabled: false,
            ...meta,
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
    it('requires a birth day when birthDayEnabled', () => {
        const webshop = createWebshop({ birthDayEnabled: true });
        const checkout = Checkout.create({ customer: createValidCustomer() });

        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, false)).toThrow(/birth day/i);

        checkout.customer.birthDay = new Date('2000-01-01');
        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, false)).not.toThrow();
    });

    it('does not require a birth day for admins', () => {
        const webshop = createWebshop({ birthDayEnabled: true });
        const checkout = Checkout.create({ customer: createValidCustomer() });

        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, true)).not.toThrow();
    });

    it('clears the birth day when birthDayEnabled is false', () => {
        const webshop = createWebshop({ birthDayEnabled: false });
        const customer = createValidCustomer();
        customer.birthDay = new Date('2000-01-01');
        const checkout = Checkout.create({ customer });

        checkout.validateCustomer(webshop, organizationMeta, i18n, false);
        expect(checkout.customer.birthDay).toBeNull();
    });

    it('requires an address when addressEnabled', () => {
        const webshop = createWebshop({ addressEnabled: true });
        const checkout = Checkout.create({ customer: createValidCustomer() });

        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, false)).toThrow(/address/i);

        checkout.customer.address = createAddress();
        expect(() => checkout.validateCustomer(webshop, organizationMeta, i18n, false)).not.toThrow();
    });

    it('clears the customer address when addressEnabled is false and there is no delivery address', () => {
        const webshop = createWebshop({ addressEnabled: false });
        const customer = createValidCustomer();
        customer.address = createAddress();
        const checkout = Checkout.create({ customer });

        checkout.validateCustomer(webshop, organizationMeta, i18n, false);
        expect(checkout.customer.address).toBeNull();
    });

    it('resets the gender when genderEnabled is false', () => {
        const webshop = createWebshop({ genderEnabled: false });
        const customer = createValidCustomer();
        customer.gender = Gender.Female;
        const checkout = Checkout.create({ customer });

        checkout.validateCustomer(webshop, organizationMeta, i18n, false);
        expect(checkout.customer.gender).toBe(Gender.Other);
    });

    it('keeps the gender when genderEnabled is true', () => {
        const webshop = createWebshop({ genderEnabled: true });
        const customer = createValidCustomer();
        customer.gender = Gender.Female;
        const checkout = Checkout.create({ customer });

        checkout.validateCustomer(webshop, organizationMeta, i18n, false);
        expect(checkout.customer.gender).toBe(Gender.Female);
    });
});

describe('Checkout.validateDeliveryAddress', () => {
    it('copies the delivery address to the customer even when addressEnabled is false', () => {
        const address = createAddress();
        const checkoutMethod = WebshopDeliveryMethod.create({
            countries: [address.country],
        });
        const webshop = createWebshop({ addressEnabled: false });
        const checkout = Checkout.create({
            customer: createValidCustomer(),
            checkoutMethod,
            address,
            cart: Cart.create({}),
        });

        checkout.validateDeliveryAddress(webshop, organizationMeta);
        expect(checkout.customer.address).toStrictEqual(address);
    });
});
