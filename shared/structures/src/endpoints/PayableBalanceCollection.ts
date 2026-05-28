import { ArrayDecoder, AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { BalanceItem, BalanceItemWithPayments } from '../BalanceItem.js';
import { PaymentGeneral } from '../members/PaymentGeneral.js';
import { BaseOrganization, Organization } from '../Organization.js';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';
import { Payment } from '../members/Payment.js';

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
    @field({ decoder: BaseOrganization })
    organization: BaseOrganization;

    @field({ decoder: new ArrayDecoder(BalanceItemWithPayments) })
    balanceItems: BalanceItemWithPayments[] = [];

    // todo
    @field({ decoder: new ArrayDecoder(PaymentGeneral) })
    @field({ decoder: new ArrayDecoder(Payment), ...NextVersion})
    payments: Payment[] = [];

    get filteredBalanceItems() {
        return BalanceItem.filterBalanceItems(this.balanceItems);
    }

    get payableBalanceItems() {
        return BalanceItem.filterPayableBalanceItems(this.balanceItems);
    }

    get discountBalanceItems() {
        return BalanceItem.filterDiscountBalanceItems(this.balanceItems);
    }
}

export class DetailedPayableBalanceCollection extends AutoEncoder {
    /**
     * Debt you have to other organizations
     */
    @field({ decoder: new ArrayDecoder(DetailedPayableBalance) })
    organizations: DetailedPayableBalance[] = [];
}
