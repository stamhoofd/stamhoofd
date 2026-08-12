import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

/**
 * Links a payment to a settlement it was part of. One payment can appear in multiple settlements
 * (e.g. the payment in one payout, its refund in a later payout).
 */
export class PaymentSettlement extends QueryableModel {
    static table = 'payment_settlements';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    settlementId: string;

    @column({ type: 'string' })
    paymentId: string;

    /**
     * Owner of the payout, which is also the organization of the payment: a payment is only ever
     * settled by the payouts of its own organization.
     */
    @column({ type: 'string' })
    organizationId: string;

    /**
     * Signed effect of this payment on the payout amount.
     */
    @column({ type: 'integer' })
    amount = 0;

    /**
     * The provider's id for this entry (Stripe txn_… / Mollie entry id), unique per settlement.
     * NULL for the lines derived from application fees: those don't exist at the provider.
     */
    @column({ type: 'string', nullable: true })
    externalId: string | null = null;

    /**
     * When the provider moved the money (not the same as payments.paidAt).
     */
    @column({ type: 'datetime' })
    occurredAt: Date;

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
