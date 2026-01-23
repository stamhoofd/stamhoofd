import { column, ManyToOneRelation } from '@simonbackx/simple-database';
import { v4 as uuidv4 } from 'uuid';

import { QueryableModel } from '@stamhoofd/sql';
import { Invoice } from './Invoice.js';
import { BalanceItem } from './BalanceItem.js';
import { VATExcemptReason } from '@stamhoofd/structures';

/**
 * Keeps track of all the created invoices of a balance item, which contains how many balance was invoiced (including VAT)
 * and also how it was invoiced (since the unit price, quantity etc can't always match the balance items invoiced price due to rounding)
 */
export class InvoicedBalanceItem extends QueryableModel {
    static table = 'invoiced_balance_items';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'string', foreignKey: InvoicedBalanceItem.invoice })
    invoiceId: string;

    @column({ type: 'string', foreignKey: InvoicedBalanceItem.balanceItem })
    balanceItemId: string;

    @column({ type: 'string' })
    name = '';

    @column({ type: 'string' })
    description = '';

    /**
     * Price of the balance that was actually invoiced. Always includes VAT.
     *
     * This only explains the due balance that was invoiced so we don't invoice items multiple times. It does not correspond to the visible unit price or price on the invoice.
     *
     * - E.g. if balance item price is 5 euro including VAT (=balanceInvoicedAmount), then unit price would be 4,13 euro. You'll see this causes a rounding issue if the amount is 2, because then the price including VAT of the invoice would be 9,99 instead of 10.
     * - E.g. if balance item price is 0,242 euro including VAT (=balanceInvoicedAmount), then unit price would be 0,20 euro (no rounding issue)
     * - E.g. if balance item price is 0,243 euro including VAT (=balanceInvoicedAmount), then unit price would also be 0,20 euro (rounding issue)
     *
     * Any rounding issues are fixed on the invoice level.
     */
    @column({ type: 'integer' })
    balanceInvoicedAmount = 0;

    /**
     * quantity per ten thousand
     * We need to support 4 decimals in case of partial payments.
     * E.g. 10 euro of 30 euro was paid and is invoiced, then the amount would be 0.3333, stored as 3333
     * Mostly for legal reasons, to be able to say wat was actually bought without faking an amount
     */
    @column({ type: 'integer' })
    quantity = 1_00_00;

    /**
     * Price per piece
     * Always excludes VAT
     */
    @column({ type: 'integer' })
    unitPrice: number;

    /**
     * This is duplicated to allow altering the vat percentage of the corresponding balance item later, so
     * mistakes can be corrected and credited.
     */
    @column({ type: 'integer' })
    VATPercentage = 0;

    /**
     * Note: does not apply to unitPrice, only to the balance item at the time of invoicing
     */
    @column({ type: 'boolean' })
    VATIncluded = true;

    /**
     * This is duplicated to allow altering the vat percentage of the corresponding balance item later, so
     * mistakes can be corrected and credited.
     */
    @column({ type: 'string', nullable: true })
    VATExcempt: VATExcemptReason | null = null;

    /**
     * This should be rounded to 2 decimals to match PEPPOL requirements
     * = LineExtensionAmount
     */
    @column({ type: 'integer' })
    totalWithoutVAT = 0;

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

    static balanceItem = new ManyToOneRelation(BalanceItem, 'balanceItem');
    static invoice = new ManyToOneRelation(Invoice, 'invoice');
}
