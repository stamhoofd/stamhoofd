import { field } from "@simonbackx/simple-encoding";

import { STBillingStatus } from "../billing/STBillingStatus";
import { Organization } from "../Organization";

export class OrganizationSummary extends Organization {
    @field({ decoder: STBillingStatus })
    billingStatus: STBillingStatus
}