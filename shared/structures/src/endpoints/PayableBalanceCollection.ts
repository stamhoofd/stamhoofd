import { ArrayDecoder, AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { BalanceItem, BalanceItemWithPayments } from '../BalanceItem.js';
import { PaymentGeneral } from '../members/PaymentGeneral.js';
import { Organization } from '../Organization.js';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';

export class PayableBalance extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization;

    @field({ decoder: IntegerDecoder, version: 354 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    amountPaid = 0;

    @field({ decoder: IntegerDecoder, field: 'amount' })
    @field({ decoder: IntegerDecoder, version: 354 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    amountOpen = 0;

    @field({ decoder: IntegerDecoder, version: 335 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    amountPending = 0;
}

export class PayableBalanceCollection extends AutoEncoder {
    /**
     * Debt you have to other organizations
     */
    @field({ decoder: new ArrayDecoder(PayableBalance) })
    organizations: PayableBalance[] = [];
}

export class DetailedPayableBalance extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization;

    @field({ decoder: new ArrayDecoder(BalanceItemWithPayments) })
    balanceItems: BalanceItemWithPayments[] = [];

    @field({ decoder: new ArrayDecoder(PaymentGeneral) })
    payments: PaymentGeneral[] = [];

    get filteredBalanceItems() {
        return BalanceItem.filterBalanceItems(this.balanceItems);
    }
}

export class DetailedPayableBalanceCollection extends AutoEncoder {
    /**
     * Debt you have to other organizations
     */
    @field({ decoder: new ArrayDecoder(DetailedPayableBalance) })
    organizations: DetailedPayableBalance[] = [];
}
