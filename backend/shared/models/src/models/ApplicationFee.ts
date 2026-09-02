import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import type { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * One component (service or transfer part) of an application fee the platform charged on a payment:
 * income for the receiving organization, a cost for the paying organization. The paying side is a
 * settlement_charges row (settlementChargeId); the receiving side is billed via a balance item
 * (balanceItemId) and received in a payout (settlementId).
 *
 * Every row belongs to the receiving organization, like the balance item it creates.
 */
export class ApplicationFee extends QueryableModel {
    static table = 'application_fees';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    /**
     * The provider's id of the application fee (Stripe fee_… id). One fee splits into at most one
     * row per type, so (externalId, type) is unique.
     */
    @column({ type: 'string' })
    externalId: string;

    @column({ type: 'string' })
    type: ApplicationFeeType;

    /**
     * What the receiving organization gets for this component (positive, 1/10000 units).
     */
    @column({ type: 'integer' })
    amount = 0;

    /**
     * The receiving organization: the platform organization that charged this fee, and the owner of
     * the balance item billing it.
     */
    @column({ type: 'string' })
    organizationId: string;

    /**
     * The paying organization: the connected organization whose payout the fee was deducted from.
     * NULL when that organization no longer exists: the fee is then billed without a payer.
     */
    @column({ type: 'string', nullable: true })
    payingOrganizationId: string | null = null;

    /**
     * The Stripe account of the paying organization the fee was deducted from. An organization can
     * have multiple, and fees are billed per account.
     */
    @column({ type: 'string', nullable: true })
    payingStripeAccountId: string | null = null;

    /**
     * The paying organization's customer payment the fee was charged on.
     */
    @column({ type: 'string', nullable: true })
    payingPaymentId: string | null = null;

    /**
     * The deduction charge on the paying organization's payout
     * (ApplicationFeeService/ApplicationFeeTransfer, same amount but negative). NULL when there is
     * no payout left to deduct it from: the payer is unknown or its organization is deleted.
     */
    @column({ type: 'string', nullable: true })
    settlementChargeId: string | null = null;

    /**
     * The payout in which the receiving organization was paid this fee. NULL until that payout is
     * synced.
     */
    @column({ type: 'string', nullable: true })
    settlementId: string | null = null;

    /**
     * The balance item billing this fee to the paying organization. NULL means not yet invoiced:
     * the invoicer will pick it up.
     */
    @column({ type: 'string', nullable: true })
    balanceItemId: string | null = null;

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
