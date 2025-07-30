import { ModuleType } from '../ModuleType';
import { PaymentMethod } from '../PaymentMethod';
import { Fees, TariffDefinition, Tier, Tiers, TransactionFee } from '../TariffDefinition';

const transactionFees = new Map([
    [PaymentMethod.Bancontact, [
        new TransactionFee({ fixed: 30, percentage: 75, isInflated: true, maximum: 250 }),
    ]],
    [PaymentMethod.iDEAL, [
        new TransactionFee({ fixed: 30, percentage: 75, isInflated: true, maximum: 250 }),
    ]],
    [PaymentMethod.Transfer, [
        new TransactionFee({ }),
    ]],
    [PaymentMethod.PointOfSale, [
        new TransactionFee({ }),
    ]],
]);

const smashTier = new Tier({
    minimumPersons: 100,

    fees: new Fees({
        setupCost: 195_00,
        perPerson: 375,
    }),
    /**
     * Online paymetns are not supported in the first tier
     */
    transactionFees: new Map([
        [PaymentMethod.Transfer, [
            new TransactionFee({ }),
        ]],
        [PaymentMethod.PointOfSale, [
            new TransactionFee({ }),
        ]],
    ]),
});

const hattrickTier = new Tier({
    minimumPersons: 100,

    fees: new Fees({
        setupCost: 195_00,
        setupCostOnlinePayments: 49_00, // 49 euro setup for online payments
        perPerson: 475,
    }),
    /**
     * Online paymetns are not supported in the first tier
     */
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

export const TwizzitTariffs = new TariffDefinition({
    name: 'Twizzit',
    modules: new Map([
        [ModuleType.Members, new Tiers([
            smashTier,
            hattrickTier,
        ])],
        [ModuleType.Tickets, new Tiers([ticketsTier])],
        [ModuleType.Webshops, new Tiers([webshopTier])],
    ]),
});
