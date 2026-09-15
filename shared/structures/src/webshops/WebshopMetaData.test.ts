import { describe, expect, it } from 'vitest';

import { CustomerFieldRequirement } from './CustomerFieldRequirement.js';
import { CustomerSettings } from './CustomerSettings.js';
import { WebshopMetaData } from './WebshopMetaData.js';

const { Required, Optional, Disabled } = CustomerFieldRequirement;

describe('WebshopMetaData.resolvedCustomerSettings', () => {
    it('falls back to the deprecated flags', () => {
        const meta = WebshopMetaData.create({ phoneEnabled: true, birthDayEnabled: false, genderEnabled: true, addressEnabled: false });

        expect(meta.resolvedCustomerSettings.phone).toBe(Required);
        expect(meta.resolvedCustomerSettings.birthDay).toBe(Disabled);
        expect(meta.resolvedCustomerSettings.gender).toBe(Required);
        expect(meta.resolvedCustomerSettings.address).toBe(Disabled);
    });

    it('prefers the stored settings over the deprecated flags', () => {
        const meta = WebshopMetaData.create({
            phoneEnabled: true,
            customerSettings: CustomerSettings.create({ phone: Optional, birthDay: Required }),
        });

        expect(meta.resolvedCustomerSettings.phone).toBe(Optional);
        expect(meta.resolvedCustomerSettings.birthDay).toBe(Required);
    });

    it('always requires the email address', () => {
        expect(WebshopMetaData.create({}).resolvedCustomerSettings.email).toBe(Required);
        expect(WebshopMetaData.create({ customerSettings: CustomerSettings.create({ email: Disabled }) }).resolvedCustomerSettings.email).toBe(Required);
    });
});
