import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import type { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Every charge in a settlement that is not a payment: application fees (mirrored on both the organization
 * and the platform payout), provider fees, VAT, transfers, reserves and disputes.
 */
export class SettlementCharge extends QueryableModel {
    static table = 'settlement_charges';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    type: SettlementChargeType;

    /**
     * Globally unique, deterministic id so every sync can upsert. Fee rows use `<feeId>:<type>`,
     * other rows the provider's transaction id (txn_…, txn_…:fee:<i>, fr_…).
     */
    @column({ type: 'string' })
    externalId: string;

    /**
     * Signed effect on the `settlementId` payout.
     */
    @column({ type: 'integer' })
    amount = 0;

    /**
     * The payout containing this charge. NULL until that payout is synced.
     */
    @column({ type: 'string', nullable: true })
    settlementId: string | null = null;

    /**
     * Stripe fee_… id: links the deduction rows on the organization payout to the Received rows on our
     * platform payout of the same application fee.
     */
    @column({ type: 'string', nullable: true })
    applicationFeeId: string | null = null;

    @column({ type: 'string', nullable: true })
    paymentId: string | null = null;

    /**
     * Stamped when the charge is invoiced (Received rows only).
     */
    @column({ type: 'string', nullable: true })
    balanceItemId: string | null = null;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    @column({ type: 'string', nullable: true })
    stripeAccountId: string | null = null;

    /**
     * Which monthly provider invoice bills this fee: Mollie's real invoice id (inv_…) or the
     * derived `stripe-YYYY-MM`. Only set on provider-fee rows (ProviderTransactionFee,
     * ProviderAccountFee, Tax).
     */
    @column({ type: 'string', nullable: true })
    providerInvoiceId: string | null = null;

    @column({ type: 'string' })
    description = '';

    /**
     * When the provider created the charge. For application fees this drives the monthly
     * invoice grouping.
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
