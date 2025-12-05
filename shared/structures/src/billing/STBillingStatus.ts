import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';
import { STCredit } from './STCredit.js';

import { STInvoice } from './STInvoice.js';
import { STPackage } from './STPackage.js';
import { OrganizationPaymentMandate } from './OrganizationPaymentMandate.js';
import { STPendingInvoice } from './STPendingInvoice.js';

export class STBillingStatus extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(STInvoice) })
    invoices: STInvoice[];

    @field({ decoder: new ArrayDecoder(STPackage) })
    packages: STPackage[];

    @field({ decoder: STPendingInvoice, nullable: true })
    pendingInvoice: STPendingInvoice | null;

    @field({ decoder: new ArrayDecoder(STCredit) })
    credits: STCredit[];

    @field({ decoder: new ArrayDecoder(OrganizationPaymentMandate), optional: true })
    mandates: OrganizationPaymentMandate[] = [];
}
