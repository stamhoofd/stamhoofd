import { column, ManyToOneRelation } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { STInvoiceMeta } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { Organization } from './index.js';

/**
 * Things that should get paid, but are not yet invoiced yet because:
 * - total price is too low
 * - auto renewals waiting for payment
 *
 * When they are about to get paid, we create a new invoice model
 * and if that model is marked as paid, it will remove the corresponding
 * items in this pending invoice.
 *
 * So please make sure you don't edit existing items, unless you change the id
 */
export class STPendingInvoice extends QueryableModel {
    static table = 'stamhoofd_pending_invoices';

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ foreignKey: STPendingInvoice.organization, type: 'string', nullable: true })
    organizationId: string | null;

    @column({ type: 'json', decoder: STInvoiceMeta })
    meta: STInvoiceMeta;

    /// We can only have one invoice at a time for the pending invoice items
    /// So until this invoice is marked as 'failed', we don't create new invoices for this pending invoice
    @column({ type: 'string', nullable: true })
    invoiceId: string | null = null;

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

    static organization = new ManyToOneRelation(Organization, 'organization');
}
