import { ModuleType } from '../ModuleType';
import { PaymentMethod } from '../PaymentMethod';
import { Fees, TariffDefinition, Tier, Tiers, TransferFee } from '../TariffDefinition';

const membersTier = new Tier({
    fees: new Fees({
        perPerson: 1_0000,
    }),
    transactionFees: new Map([
        [PaymentMethod.Payconiq, [new TransferFee({ fixed: 2000 })]],
        [PaymentMethod.Bancontact, [
            new TransferFee({ fixed: 2400, percentage: 20, provider: 'Stripe' }),
            new TransferFee({ fixed: 3300, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.iDEAL, [
            new TransferFee({ fixed: 2100, percentage: 20, provider: 'Stripe' }),
            new TransferFee({ fixed: 3200, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.CreditCard, [
            new TransferFee({ fixed: 2500, percentage: 1_50, provider: 'Stripe' }),
        ]],
        [PaymentMethod.Transfer, [new TransferFee({})]],
        [PaymentMethod.PointOfSale, [new TransferFee({})]],
    ]),
});

const webshopsTier = new Tier({
    fees: new Fees({
        perUnit: 0,
        percentage: 200,
        maxPerUnit: 20_00,
    }),
    transactionFees: new Map([
        [PaymentMethod.Payconiq, [new TransferFee({ fixed: 2000 })]],
        [PaymentMethod.Bancontact, [
            new TransferFee({ fixed: 2400, percentage: 20, provider: 'Stripe' }),
            new TransferFee({ fixed: 3300, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.iDEAL, [
            new TransferFee({ fixed: 2100, percentage: 20, provider: 'Stripe' }),
            new TransferFee({ fixed: 3200, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.CreditCard, [
            new TransferFee({ fixed: 2500, percentage: 1_50, provider: 'Stripe' }),
        ]],
        [PaymentMethod.Transfer, [new TransferFee({})]],
        [PaymentMethod.PointOfSale, [new TransferFee({})]],
    ]),
});

const ticketsTier = new Tier({
    fees: new Fees({
        perUnit: 0,
        percentage: 200,
        maxPerUnit: 20_00,
    }),
    transactionFees: new Map([
        [PaymentMethod.Payconiq, [new TransferFee({ fixed: 2000 })]],
        [PaymentMethod.Bancontact, [
            new TransferFee({ fixed: 2400, percentage: 20, provider: 'Stripe' }),
            new TransferFee({ fixed: 3300, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.iDEAL, [
            new TransferFee({ fixed: 2100, percentage: 20, provider: 'Stripe' }),
            new TransferFee({ fixed: 3200, percentage: 0, provider: 'Mollie', onlyRegisteredBusinesses: true }),
        ]],
        [PaymentMethod.CreditCard, [
            new TransferFee({ fixed: 2500, percentage: 1_50, provider: 'Stripe' }),
        ]],
        [PaymentMethod.Transfer, [new TransferFee({})]],
        [PaymentMethod.PointOfSale, [new TransferFee({})]],
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
