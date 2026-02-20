import { column } from '@simonbackx/simple-database';
import { Company, File, Invoice as InvoiceStruct, PaymentCustomer, VATSubtotal } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { QueryableModel } from '@stamhoofd/sql';
import { InvoicedBalanceItem } from './InvoicedBalanceItem.js';

export class Invoice extends QueryableModel {
    static table = 'invoices';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string', nullable: true })
    number: string | null = null;

    @column({ type: 'json', decoder: PaymentCustomer })
    customer = PaymentCustomer.create({});

    @column({ type: 'json', decoder: Company })
    seller = Company.create({});

    /**
     * seller organization
     */
    @column({ type: 'string' })
    organizationId: string;

    /**
     * Can be null if it is not linked to an organization.
     * This is only used to allow the payer to list their (incoming) invoices.
     *
     * In the future we could expand this with members, users, and/or orders
     */
    @column({ type: 'string', nullable: true })
    payingOrganizationId: string | null = null;

    /**
     * This is the rounding amount in cents that is applied to the normal calculation of the invoiced balance items (prices exluding VAT) to come to the actual total price of the invoice.
     *
     * This is visible on the invoice. It is use to correct for differences between the paid price and the calculated invoice price because of rounding issues or things that can't be represented properly in PEPPOL due to rounding
     *
     * - Say we invoice 31 items of 5 euro including VAT, so 4,13 euro excluding VAT. This means InvoicedBalanceItem has
     *      - balanceInvoicedAmount = 5 euro
     *      - amount = 31_00_00 (31 pieces)
     *      - unitPrice = 4_13_00 (4,13 euro excluding VAT, rounded to 1 cent because of PEPPOL)
     *   The normal invoiced sum would be 155 euro if we sum balanceInvoicedAmount
     *   But the invoice total price will be 128,03 excluding VAT, and 154,92 euro including VAT because of rounding rules (round on total level, not individual item level).
     *   In this case payableRoundingAmount would be 0,08 euro, because that is the price that needs to be added to the normal calculation to come to the actual invoice total price that needs to be paid (155 euro).
     *   A different solution might be to increase the price excluding VAT of some items by 0,07 euro (or add an extra item on the invoice with the same VAT rate), so the total excluding VAT becomes 128,10 euro, and including VAT 155 euro. This is not always possible though, in some cases we maintain a difference of 1 cent.
     *   balanceRoundingAmount would be 0 because there is no difference lower than 1 cent.
     */
    @column({ type: 'integer' })
    payableRoundingAmount: number = 0;

    /**
     * List of VAT per VAT rate or category. This is stored in case the calculation changes over time.
     */
    @column({ type: 'json', decoder: new ArrayDecoder(VATSubtotal) })
    VATTotal: VATSubtotal[] = [];

    @column({ type: 'integer' })
    VATTotalAmount = 0;

    @column({ type: 'integer' })
    totalWithoutVAT = 0;

    @column({ type: 'integer' })
    totalBalanceInvoicedAmount = 0;

    @column({ type: 'integer' })
    totalWithVAT = 0;

    @column({ type: 'string', nullable: true })
    ipAddress: string | null = null;

    @column({ type: 'string', nullable: true })
    userAgent: string | null = null;

    @column({ type: 'string', nullable: true })
    stripeAccountId: string | null = null;

    @column({ type: 'string', nullable: true })
    reference: string | null = null;

    @column({ type: 'json', decoder: File, nullable: true })
    pdf: File | null = null;

    @column({ type: 'json', decoder: File, nullable: true })
    xml: File | null = null;

    /**
     * If a invoice was refunded because of a cancellation, we store the negative invoice id here
     */
    @column({ type: 'string', nullable: true })
    negativeInvoiceId: string | null = null;

    @column({ type: 'boolean' })
    didSendPeppol = false;

    /**
     * Official invoice date. Set when a number has been generated.
     */
    @column({
        type: 'datetime',
        nullable: true,
        beforeSave(old?: any) {
            if (old !== undefined || !this.number) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    invoicedAt: Date | null = null;

    /**
     * If null, invoicedAt is used
     */
    @column({ type: 'datetime', nullable: true })
    dueAt: Date | null = null;

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

    _forceUpdatedAt: Date | null = null;

    @column({
        type: 'datetime', beforeSave() {
            if (this._forceUpdatedAt) {
                return this._forceUpdatedAt;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    static async loadBalanceItems(invoices: Invoice[]) {
        if (invoices.length === 0) {
            return { invoicedBalanceItems: [] };
        }
        // Load all the related models from the database so we can build the structures
        const invoicedBalanceItems = await InvoicedBalanceItem.select().where('invoiceId', invoices.map(i => i.id)).fetch();
        return { invoicedBalanceItems };
    }
}
