import { AutoEncoder, BooleanDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { VATExcemptReason } from '../BalanceItem.js';

export class InvoicedBalanceItem extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    description = '';

    @field({ decoder: IntegerDecoder })
    amount = 1;

    @field({ decoder: IntegerDecoder })
    unitPrice = 0;

    /**
     * This is duplicated to allow altering the vat percentage of the corresponding balance item later, so
     * mistakes can be corrected and credited.
     */
    @field({ decoder: IntegerDecoder })
    VATPercentage: number = 0;

    /**
     * This is duplicated to allow altering the vat percentage of the corresponding balance item later, so
     * mistakes can be corrected and credited.
     */
    @field({ decoder: BooleanDecoder })
    VATIncluded = true;

    /**
     * This is duplicated to allow altering the vat percentage of the corresponding balance item later, so
     * mistakes can be corrected and credited.
     */
    @field({ decoder: new EnumDecoder(VATExcemptReason), nullable: true })
    VATExcempt: VATExcemptReason | null = null;

    /**
     * Cached value so we can correct how much has been paid of an invoice exactly.
     */
    @field({ decoder: IntegerDecoder })
    pricePaid = 0;
}
