import { ArrayDecoder, AutoEncoder, field } from "@simonbackx/simple-encoding";

import { STInvoice, STPendingInvoice } from "./STInvoice";
import { STPackage } from "./STPackage";

export class STBillingStatus extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(STInvoice) })
    invoices: STInvoice[]

    @field({ decoder: new ArrayDecoder(STPackage) })
    packages: STPackage[]

    @field({ decoder: STPendingInvoice, nullable: true })
    pendingInvoice: STPendingInvoice | null
}