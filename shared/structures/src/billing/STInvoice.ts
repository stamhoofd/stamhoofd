import { AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { Payment } from '../members/Payment.js';
import { STInvoiceMeta } from './STInvoiceMeta.js';

export class STInvoice extends AutoEncoder {
    /**
     * This ID is empty for a pending invoice
     */
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: Payment, nullable: true })
    payment: Payment | null = null;

    @field({ decoder: STInvoiceMeta })
    meta: STInvoiceMeta;

    /**
     * If the number is null, no invoice is generated yet. Its still a WIP invoice (not an official one!)
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    number: number | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    updatedAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    paidAt: Date | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 245 })
    negativeInvoiceId: string | null = null;

    @field({ decoder: BooleanDecoder, optional: true })
    didSendPeppol = false;
}
