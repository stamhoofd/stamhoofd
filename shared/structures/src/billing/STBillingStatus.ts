import { ArrayDecoder, AutoEncoder, field } from "@simonbackx/simple-encoding";

import { OrganizationPaymentMandate } from "./OrganizationPaymentMandate";
import { STCredit } from "./STCredit";
import { STInvoice, STPendingInvoice } from "./STInvoice";
import { STPackage } from "./STPackage";

export class STBillingStatus extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(STInvoice) })
    invoices: STInvoice[]

    @field({ decoder: new ArrayDecoder(STPackage) })
    packages: STPackage[]

    @field({ decoder: STPendingInvoice, nullable: true })
    pendingInvoice: STPendingInvoice | null

    @field({ decoder: new ArrayDecoder(STCredit) })
    credits: STCredit[]

    @field({ decoder: new ArrayDecoder(OrganizationPaymentMandate), optional: true })
    mandates: OrganizationPaymentMandate[] = [];
}