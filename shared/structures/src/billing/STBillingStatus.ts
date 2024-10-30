import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';
import { STCredit } from './STCredit.js';

import { STInvoice, STPendingInvoice } from './STInvoice.js';
import { STPackage } from './STPackage.js';

export class STBillingStatus extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(STInvoice) })
    invoices: STInvoice[];

    @field({ decoder: new ArrayDecoder(STPackage) })
    packages: STPackage[];

    @field({ decoder: STPendingInvoice, nullable: true })
    pendingInvoice: STPendingInvoice | null;

    @field({ decoder: new ArrayDecoder(STCredit) })
    credits: STCredit[];
}
