import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";

import { Address } from "../addresses/Address";
import { STBillingStatus } from "../billing/STBillingStatus";
import { Organization } from "../Organization";
import { OrganizationEmail } from "../OrganizationEmail";
import { OrganizationPackages } from "../OrganizationMetaData";
import { AcquisitionType } from "../OrganizationPrivateMetaData";
import { OrganizationType } from "../OrganizationType";
import { UmbrellaOrganization } from "../UmbrellaOrganization";
import { User } from "../User";

export class OrganizationStats extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    activeWebshops: number;

    @field({ decoder: IntegerDecoder })
    memberCount: number;

    @field({ decoder: IntegerDecoder })
    orderCount: number;

    @field({ decoder: IntegerDecoder })
    webshopRevenue: number;

    @field({ decoder: IntegerDecoder })
    activeAdmins: number;
}

export class OrganizationSummary extends Organization {
    @field({ decoder: STBillingStatus })
    billingStatus: STBillingStatus

    @field({ decoder: DateDecoder })
    createdAt: Date

    @field({ decoder: DateDecoder, nullable: true })
    lastActiveAt: Date | null = null

    @field({ decoder: OrganizationStats })
    stats: OrganizationStats

    @field({ decoder: new ArrayDecoder(new EnumDecoder(AcquisitionType)), version: 130 })
    acquisitionTypes: AcquisitionType[] = [];
}

export class OrganizationOverview extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    /**
     * Name of the organization you are creating
     */
    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: new EnumDecoder(OrganizationType), version: 90 })
    type: OrganizationType;

    @field({ decoder: new EnumDecoder(UmbrellaOrganization), nullable: true, version: 90 })
    umbrellaOrganization: UmbrellaOrganization | null = null;

    @field({ decoder: Address })
    address: Address;

    @field({ decoder: DateDecoder })
    createdAt: Date;

    @field({ decoder: OrganizationPackages })
    packages: OrganizationPackages;

    @field({ decoder: new ArrayDecoder(User), optional: true, version: 90 })
    admins: User[]

    @field({ decoder: new ArrayDecoder(OrganizationEmail), version: 90 })
    emails: OrganizationEmail[] = [];

    @field({ decoder: OrganizationStats, version: 90 })
    stats: OrganizationStats
}