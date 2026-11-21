import { EncodeMedium } from '@common/encoding';
import { PaymentMethod, Version } from '@stamhoofd/structures';
import { StripeAccount } from './StripeAccount.js';

describe('Model.StripeAccount', () => {
    test('converts Stripe capabilities to a Map without changing the external blob', () => {
        const account = {
            charges_enabled: true,
            payouts_enabled: true,
            capabilities: { card_payments: 'active', ideal_payments: 'pending' },
            requirements: {},
            future_requirements: {},
        };
        const model = new StripeAccount();
        model.setMetaFromStripeAccount(account);
        expect(model.meta.capabilities).toEqual(new Map(Object.entries(account.capabilities)));
        expect(model.meta.paymentMethods).toEqual([PaymentMethod.CreditCard]);
        expect(model.meta.blob).toBe(account);
        const encoded = JSON.parse(
            JSON.stringify(model.meta.encode({ version: Version, medium: EncodeMedium.Database })),
        );
        expect(encoded).toMatchObject({ capabilities: account.capabilities, blob: account });
        model.meta.capabilities.set('ideal_payments', 'active');
        expect(account.capabilities.ideal_payments).toBe('pending');
    });

    test('only includes the raw Stripe account in the structure when the blob is requested', () => {
        const account = { requirements: {}, future_requirements: {}, company: { name: 'Acme' } };
        const model = new StripeAccount();
        model.accountId = 'acct_123';
        model.setMetaFromStripeAccount(account);

        expect(model.getStructure({ includeBlob: true }).meta.blob).toBe(account);

        const struct = model.getStructure({ includeBlob: false });
        expect(struct.meta.blob).toBeNull();
        expect(struct.accountId).toBe('acct_123');
        expect(struct.meta.company?.name).toBe('Acme');
        expect(model.meta.blob).toBe(account);
    });

    test('defaults missing Stripe capabilities to an empty Map', () => {
        const model = new StripeAccount();
        model.setMetaFromStripeAccount({ requirements: {}, future_requirements: {} });
        expect(model.meta.capabilities).toEqual(new Map());
    });
});
