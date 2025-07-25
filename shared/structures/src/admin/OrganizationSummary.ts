import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { Formatter, StringCompare } from "@stamhoofd/utility";

import { Address } from "../addresses/Address";
import { OrganizationPaymentMandate } from "../billing/OrganizationPaymentMandate";
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

    @field({ decoder: StringDecoder, nullable: true, version: 154 })
    mollieCustomerId: string | null = null;

    @field({ decoder: new ArrayDecoder(OrganizationPaymentMandate), version: 154 })
    paymentMandates: OrganizationPaymentMandate[] = [];

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    features: string[] = []
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

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    features: string[] = []

    @field({ decoder: new ArrayDecoder(new EnumDecoder(AcquisitionType)), optional: true })
    acquisitionTypes: AcquisitionType[] = [];

    get fullAccessAdmins() {
        return this.admins.filter(a => a.permissions && a.permissions.hasFullAccess([]))
    }

    matchQuery(q: string) {
        if (q === this.id) {
            return true;
        }
        
        const parts = q.split(/[ -]/);
        const name = Formatter.slug(this.name)
        const orgParts = name.split(/[ -]/);

        if (q.includes('@')) {
            if (this.emails.some(e => e.email.toLocaleLowerCase() == q.toLocaleLowerCase())) {
                return true;
            }
            if (this.admins.some(a => a.email.toLocaleLowerCase() == q.toLocaleLowerCase())) {
                return true;
            }
        }

        for (const [index, part] of parts.entries()) {
            if (part.length > 1 || index >= parts.length - 1) {
                if (index < parts.length - 1) {
                    // Should be a full match of a word in name
                    if (!orgParts.some(o => o.toLocaleLowerCase() == (part.toLocaleLowerCase()))) {
                        if (
                            StringCompare.typoCount(this.address.city, part) > 0
                        ) {
                            return false;
                        }
                    }
                    continue;
                }
                if (
                    name.toLocaleLowerCase().includes(part.toLocaleLowerCase())
                ) {
                    return true;
                }

                if (
                    StringCompare.typoCount(this.address.city, part) == 0
                ) {
                    return true;
                }
            }
        }

        if (
            StringCompare.typoCount(name, q) < 2
        ) {
            return true;
        }

        if (
            StringCompare.typoCount(this.address.city, q) < 2
        ) {
            return true;
        }
        return false;
    }
}