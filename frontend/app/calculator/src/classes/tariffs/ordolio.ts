import { ModuleType } from '../ModuleType';
import { PaymentMethod } from '../PaymentMethod';
import { Fees, TariffDefinition, Tier, Tiers, TransactionFee } from '../TariffDefinition';

const transactionFees = new Map([
    [PaymentMethod.Bancontact, [
        new TransactionFee({ fixed: 25, percentage: 1_50, isInflated: true }),
    ]],
    [PaymentMethod.iDEAL, [
        new TransactionFee({ fixed: 25, percentage: 1_50, isInflated: true }),
    ]],
    [PaymentMethod.CreditCard, [
        new TransactionFee({ fixed: 25, percentage: 1_50 }),
    ]],
]);

const membersTier = new Tier({
    fees: new Fees({
        perUnit: 50,
    }),
    transactionFees,
});

const ticketsTier = new Tier({
    fees: new Fees({
        perUnit: 50,
    }),
    transactionFees,
});

const webshopTier = new Tier({
    fees: new Fees({
        percentage: 4_00, // 4% webshop
    }),
    transactionFees,
});

export const OrdolioTariffs = new TariffDefinition({
    name: 'Ordolio',
    modules: new Map([
        [ModuleType.Members, new Tiers([membersTier])],
        [ModuleType.Tickets, new Tiers([ticketsTier])],
        [ModuleType.Webshops, new Tiers([webshopTier])],
    ]),
});
