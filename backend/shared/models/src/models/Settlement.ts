import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import type { PaymentProvider } from '@stamhoofd/structures';
import { SettlementStatus } from '@stamhoofd/structures/settlements/SettlementStatus.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * One payout of a payment provider, always owned by the organization whose provider account paid
 * out. The platform's own accounts (the platform Stripe account, the platform Mollie token) belong
 * to the platform membership organization; those payouts have `stripeAccountId === null` because
 * the platform account has no stripe_accounts row. `syncedAt === null` means the settlement still
 * needs a (re)sync.
 */
export class Settlement extends QueryableModel {
    static table = 'settlements';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    provider: PaymentProvider;

    /**
     * The provider's id for this payout (Stripe payout id / Mollie settlement id).
     * Unique per provider.
     */
    @column({ type: 'string' })
    externalId: string;

    @column({ type: 'string', nullable: true })
    stripeAccountId: string | null = null;

    @column({ type: 'string' })
    organizationId: string;

    /**
     * Statement descriptor / Mollie reference, to match against a bank statement.
     */
    @column({ type: 'string' })
    reference = '';

    @column({ type: 'integer' })
    amount = 0;

    @column({ type: 'string' })
    currency = 'EUR';

    @column({ type: 'string' })
    status: SettlementStatus = SettlementStatus.Paid;

    @column({ type: 'datetime' })
    settledAt: Date;

    /**
     * Set only after a complete, error-free sync.
     */
    @column({ type: 'datetime', nullable: true })
    syncedAt: Date | null = null;

    @column({ type: 'integer' })
    syncFailureCount = 0;

    /**
     * amount minus the sum of all stored payment lines and charges, cached after every sync.
     * Expected to be 0.
     */
    @column({ type: 'integer' })
    unexplainedAmount = 0;

    /**
     * Balance transactions processed during the last sync (diagnostic).
     */
    @column({ type: 'integer' })
    transactionCount = 0;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;
}
