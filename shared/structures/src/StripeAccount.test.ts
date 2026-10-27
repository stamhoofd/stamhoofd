import { AutoEncoder, EncodeMedium, ObjectData } from '@common/encoding';
import { PaymentMethod } from './PaymentMethod.js';
import { StripeAccount, StripeMetaData } from '#StripeAccount.ts';
import { Version } from './Version.js';

const createAccount = (options: {
    current_deadline?: number;
    future_deadline?: number;
    missingData?: boolean;
}): StripeAccount => {
    const account = new StripeAccount();
    const meta = new StripeMetaData();

    if (options.current_deadline) meta.requirements.current_deadline = options.current_deadline;
    if (options.future_deadline) meta.future_requirements.current_deadline = options.future_deadline;
    if (options.missingData) meta.requirements.currently_due = ['company.verification.document'];

    account.meta = meta;
    return account;
};

describe('StripeAccount', () => {
    [
        {
            type: 'current',
            options: {
                current_deadline: new Date().getTime(),
            },
        },
        {
            type: 'feature',
            options: {
                future_deadline: new Date().getTime(),
            },
        },
    ].forEach((testSet) => {
        test(`It shows an error with the details when there are missing details and a ${testSet.type} deadline`, () => {
            const account = createAccount({
                ...testSet.options,
                missingData: true,
            });

            expect(account.warning?.text).toContain('%Zg4');
        });

        test(`It show an error without specifics when none are present for a ${testSet.type} deadline`, () => {
            const account = createAccount({
                ...testSet.options,
            });

            expect(account.warning?.text).not.toContain('%Zg4');
        });
    });
});

describe('Stripe capabilities', () => {
    for (const version of [0, 209, Version]) {
        for (const medium of [EncodeMedium.Network, EncodeMedium.Database]) {
            const context = { version, medium };

            test(`preserves historical JSON at version ${version} for ${medium}`, () => {
                const payload = { capabilities: { card_payments: 'active', ideal_payments: 'pending' } };
                const meta = StripeMetaData.decode(new ObjectData(payload, context));
                expect(meta.capabilities).toEqual(new Map(Object.entries(payload.capabilities)));
                expect(JSON.parse(JSON.stringify(meta.encode(context)))).toMatchObject(payload);
            });

            test(`preserves empty, omitted and undefined defaults at version ${version} for ${medium}`, () => {
                for (const payload of [{}, { capabilities: undefined }, { capabilities: {} }]) {
                    const meta = StripeMetaData.decode(new ObjectData(payload, context));
                    expect(meta.capabilities).toEqual(new Map());
                    expect(JSON.parse(JSON.stringify(meta.encode(context)))).toMatchObject({ capabilities: {} });
                }
            });

            test(`preserves replacement patches at version ${version} for ${medium}`, () => {
                const original = StripeMetaData.create({ capabilities: new Map([['card_payments', 'active'], ['ideal_payments', 'pending']]) });
                for (const capabilities of [{}, { bancontact_payments: 'active' }]) {
                    const payload = { _isPatch: true, capabilities };
                    const patch = StripeMetaData.patchType().decode(new ObjectData(payload, context));
                    expect(JSON.parse(JSON.stringify(patch.encode(context)))).toEqual(payload);
                    expect(original.patch(patch).capabilities).toEqual(new Map(Object.entries(capabilities)));
                }
                const omitted = StripeMetaData.patchType().decode(new ObjectData({}, context));
                expect(original.patch(omitted).capabilities).toEqual(original.capabilities);
            });
        }
    }

    test('uses active capabilities only while charges are enabled', () => {
        const meta = StripeMetaData.create({
            charges_enabled: true,
            capabilities: new Map([
                ['card_payments', 'active'],
                ['bancontact_payments', 'pending'],
                ['ideal_payments', 'inactive'],
                ['sepa_debit_payments', 'active'],
            ]),
        });
        expect(meta.paymentMethods).toEqual([PaymentMethod.CreditCard, PaymentMethod.DirectDebit]);
        meta.charges_enabled = false;
        expect(meta.paymentMethods).toEqual([]);
    });

    test('isolates defaults and clones and preserves deepSet references', () => {
        const first = StripeMetaData.create({});
        const second = StripeMetaData.create({});
        expect(first.capabilities).not.toBe(second.capabilities);
        first.capabilities.set('card_payments', 'active');
        const clone = first.clone();
        expect(clone.capabilities).toEqual(first.capabilities);
        expect(clone.capabilities).not.toBe(first.capabilities);
        const reference = first.capabilities;
        first.deepSet(second);
        expect(first.capabilities).toBe(reference);
        expect(first.capabilities.size).toBe(0);
    });

    test('supports typed full replacement and incremental patches', () => {
        const original = StripeMetaData.create({ capabilities: new Map([['card_payments', 'pending']]) });
        const replacement = StripeMetaData.patch({ capabilities: new Map([['ideal_payments', 'active']]) });
        const replaced = original.patch(replacement);
        expect(replaced.capabilities).toEqual(new Map([['ideal_payments', 'active']]));
        const incremental = StripeMetaData.patch({});
        incremental.capabilities.set('ideal_payments', null);
        incremental.capabilities.set('card_payments', 'active');
        const context = { version: Version };
        const decoded = StripeMetaData.patchType().decode(new ObjectData(JSON.parse(JSON.stringify(incremental.encode(context))), context));
        expect(replaced.patch(decoded).capabilities).toEqual(new Map([['card_payments', 'active']]));
    });

    test('retains explicit empty capabilities when default omission is enabled', () => {
        const previous = AutoEncoder.skipDefaultValuesVersion;
        try {
            AutoEncoder.skipDefaultValuesVersion = 0;
            expect(StripeMetaData.create({}).encode({ version: Version })).toMatchObject({ capabilities: {} });
        } finally {
            AutoEncoder.skipDefaultValuesVersion = previous;
        }
    });
});
