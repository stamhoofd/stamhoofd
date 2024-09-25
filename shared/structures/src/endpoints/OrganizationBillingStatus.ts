import { ArrayDecoder, AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { Organization } from '../Organization';
import { BalanceItemWithPayments } from '../BalanceItem';
import { PaymentGeneral } from '../members/PaymentGeneral';

export class OrganizationBillingStatusItem extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization;

    @field({ decoder: IntegerDecoder })
    amount = 0;

    @field({ decoder: IntegerDecoder, version: 335 })
    amountPending = 0;
}

export class OrganizationBillingStatus extends AutoEncoder {
    /**
     * Debt you have to other organizations
     */
    @field({ decoder: new ArrayDecoder(OrganizationBillingStatusItem) })
    organizations: OrganizationBillingStatusItem[] = [];
}

export class OrganizationDetailedBillingStatusItem extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization;

    @field({ decoder: new ArrayDecoder(BalanceItemWithPayments) })
    balanceItems: BalanceItemWithPayments[] = [];

    @field({ decoder: new ArrayDecoder(PaymentGeneral) })
    payments: PaymentGeneral[] = [];
}

export class OrganizationDetailedBillingStatus extends AutoEncoder {
    /**
     * Debt you have to other organizations
     */
    @field({ decoder: new ArrayDecoder(OrganizationDetailedBillingStatusItem) })
    organizations: OrganizationDetailedBillingStatusItem[] = [];
}
