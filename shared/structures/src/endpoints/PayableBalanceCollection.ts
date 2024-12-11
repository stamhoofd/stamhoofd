import { ArrayDecoder, AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { Organization } from '../Organization.js';
import { BalanceItemWithPayments } from '../BalanceItem.js';
import { PaymentGeneral } from '../members/PaymentGeneral.js';
import { Sorter } from '@stamhoofd/utility';

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

    get filteredBalanceItems() {
        return this.balanceItems.filter(i => BalanceItemWithPayments.getOutstandingBalance([i]).priceOpen !== 0).sort((a, b) => Sorter.stack(
            Sorter.byDateValue(b.dueAt ?? new Date(0), a.dueAt ?? new Date(0)),
            Sorter.byDateValue(b.createdAt, a.createdAt),
        ));
    }
}

export class DetailedPayableBalanceCollection extends AutoEncoder {
    /**
     * Debt you have to other organizations
     */
    @field({ decoder: new ArrayDecoder(DetailedPayableBalance) })
    organizations: DetailedPayableBalance[] = [];
}
