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
    @field({ decoder: new ArrayDecoder(Payment), version: 399 })
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

    /**
     * Whether the payable items contain items with a VAT rate that is added on top of the price (excluding VAT).
     * When this is the case, the item prices become hard to read (they include rounded VAT), so we show the
     * prices excluding VAT together with a separate VAT overview instead.
     */
    get hasExclusiveVAT() {
        return this.payableBalanceItems.some(item => !item.VATIncluded && !!item.VATPercentage);
    }

    /**
     * VAT of the payable items, grouped per VAT percentage.
     * Based on the full payable prices, so it reconciles with the listed item prices and the total.
     */
    get VATBreakdown() {
        return BalanceItem.getPayableVATBreakdown(this.payableBalanceItems);
    }
}

export class DetailedPayableBalanceCollection extends AutoEncoder {
    /**
     * Debt you have to other organizations
     */
    @field({ decoder: new ArrayDecoder(DetailedPayableBalance) })
    organizations: DetailedPayableBalance[] = [];
}
