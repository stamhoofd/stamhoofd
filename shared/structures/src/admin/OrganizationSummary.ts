import { AutoEncoder, DateDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";

import { Address } from "../addresses/Address";
import { STBillingStatus } from "../billing/STBillingStatus";
import { Organization } from "../Organization";
import { OrganizationPackages } from "../OrganizationMetaData";

export class OrganizationSummary extends Organization {
    @field({ decoder: STBillingStatus })
    billingStatus: STBillingStatus
}

export class OrganizationOverview extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    /**
     * Name of the organization you are creating
     */
    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: Address })
    address: Address;

    @field({ decoder: DateDecoder })
    createdAt: Date;

    @field({ decoder: OrganizationPackages })
    packages: OrganizationPackages;
}