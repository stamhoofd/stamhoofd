import { Country } from '@stamhoofd/types/Country';
import { describe, expect, it } from 'vitest';

import { Address } from '../addresses/Address.js';
import { Gender } from '../members/Gender.js';
import { Customer } from './Customer.js';
import { CustomerFieldRequirement } from './CustomerFieldRequirement.js';
import { CustomerSettings } from './CustomerSettings.js';

const { Required, Optional, Disabled } = CustomerFieldRequirement;

function settings(overrides: Partial<CustomerSettings> = {}) {
    return CustomerSettings.create(overrides);
}

function customer(overrides: Partial<Customer> = {}) {
    return Customer.create({ firstName: 'John', lastName: 'Doe', ...overrides });
}

describe('Customer.validate', () => {
    it('requires a first and last name by default, also for admins', () => {
        expect(() => customer({ firstName: 'J' }).validate(settings())).toThrow(/first name/i);
        expect(() => customer({ lastName: '' }).validate(settings())).toThrow(/last name/i);
        expect(() => customer().validate(settings())).not.toThrow();
        expect(() => customer({ lastName: '' }).validate(settings(), { asAdmin: true })).toThrow(/last name/i);
    });

    it('accepts an empty name when it is optional, but still checks what is given', () => {
        expect(() => customer({ firstName: '', lastName: '' }).validate(settings({ name: Optional }))).not.toThrow();
        expect(() => customer({ firstName: 'J', lastName: '' }).validate(settings({ name: Optional }))).toThrow(/first name/i);
    });

    it('clears the name when it is disabled', () => {
        const c = customer();
        c.validate(settings({ name: Disabled }));

        expect(c.firstName).toBe('');
        expect(c.lastName).toBe('');
    });

    it('clears disabled fields', () => {
        const c = customer({ email: 'john@example.com', phone: '+32470000000', birthDay: new Date('2000-01-01'), gender: Gender.Male, address: Address.create({ street: 'A', number: '1', postalCode: '2000', city: 'Antwerpen', country: Country.Belgium }) });
        c.validate(settings());

        expect(c.email).toBe('');
        expect(c.phone).toBe('');
        expect(c.birthDay).toBeNull();
        expect(c.gender).toBe(Gender.Other);
        expect(c.address).toBeNull();
    });

    it('requires required fields', () => {
        expect(() => customer().validate(settings({ email: Required }))).toThrow(/email/i);
        expect(() => customer().validate(settings({ phone: Required }))).toThrow(/phone/i);
        expect(() => customer().validate(settings({ birthDay: Required }))).toThrow(/birth day/i);
        expect(() => customer().validate(settings({ address: Required }))).toThrow(/address/i);
        expect(() => customer({ email: 'john@example.com', phone: '+32470000000', birthDay: new Date('2000-01-01') }).validate(settings({ email: Required, phone: Required, birthDay: Required }))).not.toThrow();
    });

    it('does not require required fields for admins, except the email format', () => {
        expect(() => customer().validate(settings({ phone: Required, birthDay: Required, address: Required }), { asAdmin: true })).not.toThrow();
        expect(() => customer().validate(settings({ email: Required }), { asAdmin: true })).toThrow(/email/i);
    });

    it('accepts empty optional fields but validates their format when given', () => {
        expect(() => customer().validate(settings({ email: Optional, phone: Optional, birthDay: Optional, address: Optional }))).not.toThrow();
        expect(() => customer({ email: 'not-an-email' }).validate(settings({ email: Optional }))).toThrow(/email/i);
        expect(() => customer({ phone: '12' }).validate(settings({ phone: Optional }))).toThrow(/phone/i);

        const c = customer({ email: 'john@example.com', gender: Gender.Female });
        c.validate(settings({ email: Optional, gender: Optional }));
        expect(c.email).toBe('john@example.com');
        expect(c.gender).toBe(Gender.Female);
    });
});
