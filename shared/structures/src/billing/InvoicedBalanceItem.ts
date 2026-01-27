import { AutoEncoder, BooleanDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { BalanceItem, VATExcemptReason } from '../BalanceItem.js';
import { SimpleError } from '@simonbackx/simple-errors';

export class InvoicedBalanceItem extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    balanceItemId = '';

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
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
    @field({ decoder: IntegerDecoder })
    balanceInvoicedAmount = 0;

    /**
     * quantity per ten thousand
     * We need to support 4 decimals in case of partial payments.
     * E.g. 10 euro of 30 euro was paid and is invoiced, then the amount would be 0.3333, stored as 3333
     * Mostly for legal reasons, to be able to say wat was actually bought without faking an amount
     */
    @field({ decoder: IntegerDecoder })
    quantity = 1_00_00;

    /**
     * Price per piece
     * Always excludes VAT
     */
    @field({ decoder: IntegerDecoder })
    unitPrice = 0;

    /**
     * This is duplicated to allow altering the vat percentage of the corresponding balance item later, so
     * mistakes can be corrected and credited.
     */
    @field({ decoder: IntegerDecoder })
    VATPercentage: number = 0;

    /**
     * Note: does not apply to unitPrice, only to the balance item at the time of invoicing
     */
    @field({ decoder: BooleanDecoder })
    VATIncluded = false;

    /**
     * This is duplicated to allow altering the vat percentage of the corresponding balance item later, so
     * mistakes can be corrected and credited.
     */
    @field({ decoder: new EnumDecoder(VATExcemptReason), nullable: true })
    VATExcempt: VATExcemptReason | null = null;

    /**
     * This should be rounded to 2 decimals to match PEPPOL requirements
     * = LineExtensionAmount
     */
    get totalWithoutVAT() {
        return Math.round(this.unitPrice * this.quantity / 1_00_00_00) * 100;
    }

    /**
     * Creates a default configuration for a balance item that needs to be invoiced. The result can still be adjusted to correct rounding issues, because
     * a balanace item cannot always be perfectly represented on an invoice (on an invoice rounding happens on invoice level, while balance items can have any price that is not really rounded at any time unless when paid).
     *
     * @param balanceItem
     * @param amount paid (or to be paid) price, should always include VAT if there is VAT
     */
    static createFor(balanceItem: BalanceItem, amount: number) {
        if (balanceItem.VATPercentage === null) {
            throw new SimpleError({
                message: 'Cannot create InvoicedBalanceItem for balance item without VAT percentage',
                human: $t('3c6a76c8-1fc4-4fc3-b1b0-9eca083a0c64'),
                code: 'balance_item_without_vat_percentage',
            });
        }
        const item = new InvoicedBalanceItem();
        item.balanceItemId = balanceItem.id;
        item.name = balanceItem.itemTitle;
        item.description = balanceItem.itemDescription ?? '';
        item.balanceInvoicedAmount = amount;
        item.VATPercentage = balanceItem.VATPercentage;
        item.VATExcempt = balanceItem.VATExcempt;
        item.VATIncluded = balanceItem.VATIncluded;

        // Calculate amount and unit price
        const balanceItemUnitPriceWithVAT = Math.round(balanceItem.priceWithVAT / balanceItem.quantity);
        const quantity = Math.round(item.balanceInvoicedAmount * 1_00_00 / balanceItemUnitPriceWithVAT); // Amount per ten thousand
        if (quantity <= 0 && amount >= 0) {
            throw new SimpleError({
                message: 'Invoiced amount is too low to create an invoiced balance item',
                human: $t('551f6cc0-0b1a-4a62-8e09-cef159f5f7d5'),
                code: 'invoiced_amount_too_low',
            });
        }
        item.quantity = quantity;
        item.unitPrice = amount * 1_00_00 / quantity;

        // Remove VAT from unit price if needed
        if (!balanceItem.VATExcempt) {
            item.unitPrice = item.unitPrice * 100 / (100 + balanceItem.VATPercentage);
        }

        // Rounding the unit price is not a peppol requirement normally,
        // so this is disabled for now. Rounding will happen on line level though
        // item.unitPrice = Math.round(item.unitPrice / 100) * 100;
        // round as integer instead (0.0001):
        item.unitPrice = Math.round(item.unitPrice);

        return item;
    }
}
