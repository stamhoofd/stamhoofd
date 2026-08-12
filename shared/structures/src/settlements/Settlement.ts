import { AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { PaymentProvider } from '../PaymentProvider.js';
import { SettlementStatus } from './SettlementStatus.js';

/**
 * One payout of a payment provider, stored locally. Always owned by an organization; payouts of the
 * platform's own accounts belong to the platform membership organization and have
 * `stripeAccountId === null`.
 */
export class Settlement extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(PaymentProvider) })
    provider: PaymentProvider;

    /**
     * The provider's id for this payout (Stripe payout id / Mollie settlement id).
     */
    @field({ decoder: StringDecoder })
    externalId: string;

    @field({ decoder: StringDecoder, nullable: true })
    stripeAccountId: string | null = null;

    @field({ decoder: StringDecoder })
    organizationId: string;

    /**
     * Statement descriptor / Mollie reference, to match against a bank statement.
     */
    @field({ decoder: StringDecoder })
    reference = '';

    @field({ decoder: IntegerDecoder })
    amount = 0;

    @field({ decoder: StringDecoder })
    currency = 'EUR';

    @field({ decoder: new EnumDecoder(SettlementStatus) })
    status: SettlementStatus = SettlementStatus.Paid;

    @field({ decoder: DateDecoder })
    settledAt: Date;

    /**
     * Set only after a complete, error-free sync. NULL means "needs attention or retry".
     */
    @field({ decoder: DateDecoder, nullable: true })
    syncedAt: Date | null = null;

    @field({ decoder: IntegerDecoder })
    syncFailureCount = 0;

    /**
     * amount minus the sum of all stored payment lines, charges and pending fees, cached after
     * every sync. Expected to be 0.
     */
    @field({ decoder: IntegerDecoder })
    unexplainedAmount = 0;

    /**
     * Application fees received in this platform payout that are not invoiced yet, so no payment
     * line explains them yet.
     */
    @field({ decoder: IntegerDecoder, ...NextVersion })
    pendingFees = 0;

    @field({ decoder: IntegerDecoder })
    transactionCount = 0;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();
}
