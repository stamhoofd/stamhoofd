import { AutoEncoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { OrganizationSimple } from '../OrganizationSimple.js';
import { STInvoice } from './STInvoice.js';
import { STInvoiceMeta } from './STInvoiceMeta.js';

export class STPendingInvoice extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true, optional: true })
    id: string | null = null;

    @field({ decoder: STInvoiceMeta })
    meta: STInvoiceMeta;

    @field({ decoder: STInvoice, nullable: true })
    invoice: STInvoice | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    updatedAt: Date | null = null;
}

export class STPendingInvoicePrivate extends STPendingInvoice {
    @field({ decoder: OrganizationSimple, optional: true })
    organization?: OrganizationSimple;
}
