import { AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { Settlement } from './Settlement.js';

/**
 * Links a payment to a settlement it was part of. One payment can appear in multiple settlements
 * (e.g. the payment in one payout, its refund in a later payout).
 */
export class PaymentSettlement extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    settlementId: string;

    @field({ decoder: StringDecoder })
    paymentId: string;

    /**
     * Signed effect of this payment on the payout amount.
     */
    @field({ decoder: IntegerDecoder })
    amount = 0;

    /**
     * The provider's id for this entry (Stripe txn_… / Mollie entry id), unique per settlement.
     */
    @field({ decoder: StringDecoder })
    externalId = '';

    /**
     * When the provider moved the money (not the same as payments.paidAt).
     */
    @field({ decoder: DateDecoder })
    occurredAt: Date;
}

export class PaymentSettlementDetailed extends PaymentSettlement {
    @field({ decoder: Settlement })
    settlement: Settlement;
}
