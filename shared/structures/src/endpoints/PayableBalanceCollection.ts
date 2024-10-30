import { ArrayDecoder, AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { Organization } from '../Organization.js';
import { BalanceItemWithPayments } from '../BalanceItem.js';
import { PaymentGeneral } from '../members/PaymentGeneral.js';

export class PayableBalance extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization;

    @field({ decoder: IntegerDecoder })
    amount = 0;

    @field({ decoder: IntegerDecoder, version: 335 })
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
}

export class DetailedPayableBalanceCollection extends AutoEncoder {
    /**
     * Debt you have to other organizations
     */
    @field({ decoder: new ArrayDecoder(DetailedPayableBalance) })
    organizations: DetailedPayableBalance[] = [];
}
