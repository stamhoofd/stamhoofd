import { TestUtils } from '@stamhoofd/test-utils';
import type { InMemoryFilterDefinitions } from './filters/InMemoryFilter.js';
import { baseInMemoryFilterCompilers, compileToInMemoryFilter } from './filters/InMemoryFilter.js';
import type { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import { PaymentGeneral } from './members/PaymentGeneral.js';
import { getPaymentAccount } from './PaymentAccount.js';
import { PaymentMethod } from './PaymentMethod.js';
import { TransferSettings } from './webshops/TransferSettings.js';

describe('getPaymentAccount', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        TestUtils.setEnvironment('platformName', 'stamhoofd');
    });

    function createPayment(method: PaymentMethod, transferSettings: { iban?: string; creditor?: string } | null = null) {
        return PaymentGeneral.create({
            method,
            transferSettings: transferSettings
                ? TransferSettings.create({
                        iban: transferSettings.iban ?? null,
                        creditor: transferSettings.creditor ?? null,
                    })
                : null,
        });
    }

    /**
     * Mirrors how the api compiles these filters to SQL (see sql-filters/payments.ts): the transfer
     * settings are read out of a JSON column, so a payment without any reads as null there.
     */
    const paymentFilterCompilers: InMemoryFilterDefinitions = {
        ...baseInMemoryFilterCompilers,
        method: createValueCompiler(payment => payment.method),
        provider: createValueCompiler(payment => payment.provider),
        transferSettings: {
            ...baseInMemoryFilterCompilers,
            iban: createValueCompiler(payment => payment.transferSettings?.iban ?? null),
            creditor: createValueCompiler(payment => payment.transferSettings?.creditor ?? null),
        },
    };

    function createValueCompiler(getValue: (payment: PaymentGeneral) => unknown) {
        return (filter: StamhoofdFilter) => {
            // A plain value has to be wrapped, as compileToInMemoryFilter reads a bare null as 'no filter'
            const condition = filter !== null && typeof filter === 'object' ? filter : { $eq: filter };
            const runner = compileToInMemoryFilter(condition, baseInMemoryFilterCompilers);

            return (payment: PaymentGeneral) => runner(getValue(payment));
        };
    }

    function matches(filter: StamhoofdFilter, payment: PaymentGeneral): boolean {
        return compileToInMemoryFilter(filter, paymentFilterCompilers)(payment);
    }

    test('a payment that is no longer a transfer is not selected by the account it was paid to', () => {
        const transfer = createPayment(PaymentMethod.Transfer, { iban: 'BE68539007547034' });
        // Changing the method of a payment leaves its account number behind (see PatchPaymentsEndpoint)
        const changed = createPayment(PaymentMethod.PointOfSale, { iban: 'BE68539007547034' });

        const account = getPaymentAccount(transfer);

        expect(getPaymentAccount(changed).id).not.toBe(account.id);
        expect(matches(account.filter, transfer)).toBe(true);
        expect(matches(account.filter, changed)).toBe(false);
    });

    test('the same holds for an account that is only known by its holder', () => {
        const transfer = createPayment(PaymentMethod.Transfer, { creditor: 'Ons Chirolokaal' });
        const changed = createPayment(PaymentMethod.PointOfSale, { creditor: 'Ons Chirolokaal' });

        const account = getPaymentAccount(transfer);

        expect(getPaymentAccount(changed).id).not.toBe(account.id);
        expect(matches(account.filter, transfer)).toBe(true);
        expect(matches(account.filter, changed)).toBe(false);
    });

    test('a transfer without an account number stays out of the accounts that have one', () => {
        const withAccount = createPayment(PaymentMethod.Transfer, { iban: 'BE68539007547034' });
        const withoutAccount = createPayment(PaymentMethod.Transfer);

        const account = getPaymentAccount(withoutAccount);

        expect(account.id).not.toBe(getPaymentAccount(withAccount).id);
        expect(matches(account.filter, withoutAccount)).toBe(true);
        expect(matches(account.filter, withAccount)).toBe(false);
        expect(matches(getPaymentAccount(withAccount).filter, withoutAccount)).toBe(false);
    });
});
