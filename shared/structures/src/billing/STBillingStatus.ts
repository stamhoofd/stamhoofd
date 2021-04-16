import { ArrayDecoder, AutoEncoder, field } from "@simonbackx/simple-encoding";

import { STInvoice } from "./STInvoice";
import { STPackage } from "./STPackage";

export class STBillingStatus extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(STInvoice) })
    invoices: STInvoice[]

    @field({ decoder: new ArrayDecoder(STPackage) })
    packages: STPackage[]

    @field({ decoder: STInvoice, nullable: true })
    pendingInvoice: STInvoice | null
}