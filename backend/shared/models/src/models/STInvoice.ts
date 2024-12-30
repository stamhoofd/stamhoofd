import { column, ManyToOneRelation } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { STInvoiceMeta } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { Organization, Payment } from './';

export class STInvoice extends QueryableModel {
    static table = 'stamhoofd_invoices';

    private static numberCache: number | null = null;

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    /**
     * Is null for deleted organizations
     */
    @column({ foreignKey: STInvoice.organization, type: 'string', nullable: true })
    organizationId: string | null;

    /**
     * An associated STCredit, that was used to remove credits from the user's credits.
     * If the invoice is marked as failed, we need to delete this one
     */
    @column({ type: 'string', nullable: true })
    creditId: string | null = null;

    /**
     * Note: always create a new invoice for failed payments. We never create an actual invoice until we received the payment
     */
    @column({ type: 'string', nullable: true, foreignKey: STInvoice.payment })
    paymentId: string | null = null;

    @column({ type: 'json', decoder: STInvoiceMeta })
    meta: STInvoiceMeta;

    /**
     * If the number is null, no invoice is generated yet. Its still a WIP invoice (not an official one!)
     */
    @column({ type: 'integer', nullable: true })
    number: number | null = null;

    @column({ type: 'datetime', nullable: true })
    paidAt: Date | null = null;

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

    @column({ type: 'string', nullable: true })
    reference: string | null = null;

    static organization = new ManyToOneRelation(Organization, 'organization');
    static payment = new ManyToOneRelation(Payment, 'payment');
}
