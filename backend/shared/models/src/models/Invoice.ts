import { column } from '@simonbackx/simple-database';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { QueryableModel } from '@stamhoofd/sql';
import { Company, File, InvoiceItem, PaymentCustomer, TaxSubtotal } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

export class Invoice extends QueryableModel {
    static table = 'invoices';

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'integer', nullable: true })
    number: number | null = null;

    /**
     * Organization that made the invoice. Can be null if the organization was deleted and for the migration from V1 -> V2
     */
    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    /**
     * Organization that is associated with this invoice (can be null if deleted or unknown)
     */
    @column({ type: 'string', nullable: true })
    payingOrganizationId: string | null = null;

    /**
     * A point-in-time snapshot of the seller.
     * In case the address changes over time, or when an organization has multiple companies and some invoices
     */
    @column({ type: 'json', decoder: Company })
    seller: Company;

    /**
     * Payer
     */
    @column({ type: 'json', decoder: PaymentCustomer })
    customer: PaymentCustomer;

    @column({ type: 'json', decoder: new ArrayDecoder(InvoiceItem) })
    items: InvoiceItem[] = [];

    @column({ type: 'integer' })
    priceWithoutVAT = 0;

    @column({ type: 'integer' })
    priceWithVAT = 0;

    @column({ type: 'json', decoder: new ArrayDecoder(TaxSubtotal) })
    VATTotal: TaxSubtotal[] = [];

    /**
     * When it is an invoice for transaction fees related to a given stripe account. The stripe account id is stored here.
     */
    @column({ type: 'string', nullable: true })
    stripeAccountId: string | null = null;

    @column({ type: 'string', nullable: true })
    reference: string | null = null;

    /**
     * If this invoice has been credited, this contains the credited invoice (avoids duplicate crediting and some automatisation in case of chargebacks)
     */
    @column({ type: 'string', nullable: true })
    negativeInvoiceId: string | null = null;

    @column({ type: 'boolean' })
    didSendPeppol = false;

    @column({ type: 'json', decoder: File, nullable: true })
    pdf: File | null = null;

    @column({ type: 'json', decoder: File, nullable: true })
    xml: File | null = null;

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
