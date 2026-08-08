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

/**
 * The one settlement to show when only a single one fits (exports, the legacy blob): the largest
 * line wins, earliest settledAt as tiebreaker, so re-syncs never flip-flop the choice. Keep in sync
 * with SettlementService.updateLegacySettlementReference, which applies the same rule on the
 * database rows.
 */
export function getPrimaryPaymentSettlement(settlements: PaymentSettlementDetailed[]): PaymentSettlementDetailed | null {
    if (settlements.length === 0) {
        return null;
    }

    return [...settlements].sort((a, b) => {
        if (Math.abs(a.amount) !== Math.abs(b.amount)) {
            return Math.abs(b.amount) - Math.abs(a.amount);
        }
        if (a.settlement.settledAt.getTime() !== b.settlement.settledAt.getTime()) {
            return a.settlement.settledAt.getTime() - b.settlement.settledAt.getTime();
        }
        return a.externalId.localeCompare(b.externalId);
    })[0];
}
