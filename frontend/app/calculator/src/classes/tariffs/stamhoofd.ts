import { ModuleType } from '../ModuleType';
import { PaymentMethod } from '../PaymentMethod';
import { Fees, TariffDefinition, Tier, Tiers, TransactionFee } from '../TariffDefinition';

const membersTier = new Tier({
    fees: new Fees({
        perUnit: 0,
        percentage: 100,
        maxPerUnit: 95,
    }),
    transactionFees: new Map([
        [PaymentMethod.Payconiq, [new TransactionFee({ fixed: 20 })]],
        [PaymentMethod.Bancontact, [
            new TransactionFee({ fixed: 24, percentage: 20, provider: 'Stripe' }),
            new TransactionFee({ fixed: 33, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.iDEAL, [
            new TransactionFee({ fixed: 21, percentage: 20, provider: 'Stripe' }),
            new TransactionFee({ fixed: 32, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.CreditCard, [
            new TransactionFee({ fixed: 25, percentage: 1_50, provider: 'Stripe' }),
        ]],
        [PaymentMethod.Transfer, [new TransactionFee({})]],
        [PaymentMethod.PointOfSale, [new TransactionFee({})]],
    ]),
});

const webshopsTier = new Tier({
    fees: new Fees({
        perUnit: 0,
        percentage: 200,
        maxPerUnit: 95,
    }),
    transactionFees: new Map([
        [PaymentMethod.Payconiq, [new TransactionFee({ fixed: 20 })]],
        [PaymentMethod.Bancontact, [
            new TransactionFee({ fixed: 24, percentage: 20, provider: 'Stripe' }),
            new TransactionFee({ fixed: 33, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.iDEAL, [
            new TransactionFee({ fixed: 21, percentage: 20, provider: 'Stripe' }),
            new TransactionFee({ fixed: 32, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.CreditCard, [
            new TransactionFee({ fixed: 25, percentage: 1_50, provider: 'Stripe' }),
        ]],
        [PaymentMethod.Transfer, [new TransactionFee({})]],
        [PaymentMethod.PointOfSale, [new TransactionFee({})]],
    ]),
});

const ticketsTier = new Tier({
    fees: new Fees({
        perUnit: 0,
        percentage: 300,
        maxPerUnit: 195,
        minPerUnit: 15,
    }),
    transactionFees: new Map([
        [PaymentMethod.Payconiq, [new TransactionFee({ fixed: 20 })]],
        [PaymentMethod.Bancontact, [
            new TransactionFee({ fixed: 24, percentage: 20, provider: 'Stripe' }),
            new TransactionFee({ fixed: 33, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.iDEAL, [
            new TransactionFee({ fixed: 21, percentage: 20, provider: 'Stripe' }),
            new TransactionFee({ fixed: 32, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.CreditCard, [
            new TransactionFee({ fixed: 25, percentage: 1_50, provider: 'Stripe' }),
        ]],
        [PaymentMethod.Transfer, [new TransactionFee({})]],
        [PaymentMethod.PointOfSale, [new TransactionFee({})]],
    ]),
});

export const StamhoofdTariffs = new TariffDefinition({
    name: 'Stamhoofd',
    modules: new Map([
        [ModuleType.Members, new Tiers([membersTier])],
        [ModuleType.Tickets, new Tiers([ticketsTier])],
        [ModuleType.Webshops, new Tiers([webshopsTier])],
    ]),
});
