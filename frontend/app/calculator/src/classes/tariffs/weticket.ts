import { ModuleType } from '../ModuleType';
import { PaymentMethod } from '../PaymentMethod';
import { Fees, TariffDefinition, Tier, Tiers, TransactionFee } from '../TariffDefinition';

const transactionFees = new Map([
    [PaymentMethod.Bancontact, [
        new TransactionFee({ fixedPerTicket: 12 }),
    ]],
    [PaymentMethod.iDEAL, [
        new TransactionFee({ fixedPerTicket: 12 }),
    ]],
    [PaymentMethod.CreditCard, [
        new TransactionFee({ fixedPerTicket: 12, percentage: 2_40 }),
    ]],
]);

const defaultTier = new Tier({
    maximumUnitPrice: 100_00, // WeTicket charges different prices for tickets > 100 euro, so we set a maximum unit price of 100 euro
    fees: new Fees({
        perUnit: 18,
    }),
    transactionFees,
});

const higherPriceTier = new Tier({
    fees: new Fees({
        perUnit: 18,
        percentage: 25, // Extra 0,25% for tickets above 100 euro
    }),
    transactionFees,
});

export const WeticketTariffs = new TariffDefinition({
    name: 'WeTicket',
    modules: new Map([
        [ModuleType.Tickets, new Tiers([defaultTier, higherPriceTier])],
    ]),
});
