import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

export class StripeCheckoutSession extends QueryableModel {
    static table = 'stripe_checkout_sessions';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    paymentId: string;

    @column({ type: 'string' })
    stripeSessionId: string;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    /**
     * For direct charges, this should be set
     */
    @column({ type: 'string', nullable: true })
    accountId: string | null = null;
}
