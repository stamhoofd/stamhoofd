import { ModuleType } from '../ModuleType';
import { PaymentMethod } from '../PaymentMethod';
import { Fees, TariffDefinition, Tier, Tiers, TransactionFee } from '../TariffDefinition';

const transactionFees = new Map([
    [PaymentMethod.Bancontact, [
        new TransactionFee({ }),
    ]],
    [PaymentMethod.iDEAL, [
        new TransactionFee({ }),
    ]],
    [PaymentMethod.CreditCard, [
        new TransactionFee({ }),
    ]],
]);

const freeTicketsTier = new Tier({
    maximumUnitPrice: 0, // WeTicket charges different prices for tickets > 100 euro, so we set a maximum unit price of 100 euro
    fees: new Fees({}),
    transactionFees,
});

const paidTicketsTier = new Tier({
    fees: new Fees({
        perUnit: 49,
        percentage: 3_00,
    }),
    transactionFees,
});

export const EventbriteTariffs = new TariffDefinition({
    name: 'Eventbrite',
    modules: new Map([
        [ModuleType.Tickets, new Tiers([freeTicketsTier, paidTicketsTier])],
    ]),
});
