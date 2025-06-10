import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter, StringCompare } from '@stamhoofd/utility';

import { Address } from '../addresses/Address.js';
import { STBillingStatus } from '../billing/STBillingStatus.js';
import { Organization } from '../Organization.js';
import { OrganizationEmail } from '../OrganizationEmail.js';
import { OrganizationPackages } from '../OrganizationMetaData.js';
import { AcquisitionType } from '../OrganizationPrivateMetaData.js';
import { OrganizationType } from '../OrganizationType.js';
import { UmbrellaOrganization } from '../UmbrellaOrganization.js';
import { User } from '../User.js';

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

export class OrganizationPaymentMandateDetails extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    consumerName?: string;

    @field({ decoder: StringDecoder, optional: true })
    consumerAccount?: string;

    @field({ decoder: StringDecoder, optional: true })
    consumerBic?: string;
}

export class OrganizationPaymentMandate extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    method: 'directdebit' | 'creditcard' | 'paypal';

    @field({ decoder: StringDecoder })
    status: 'valid' | 'pending' | 'invalid';

    @field({ decoder: OrganizationPaymentMandateDetails })
    details: OrganizationPaymentMandateDetails;

    /**
     * The signature date of the mandate in YYYY-MM-DD format.
     */
    @field({ decoder: StringDecoder, nullable: true })
    signatureDate: string | null = null;

    /**
     * The mandate’s date and time of creation, in ISO 8601 format.
     */
    @field({ decoder: DateDecoder })
    createdAt: Date;

    @field({ decoder: StringDecoder, nullable: true })
    mandateReference: string | null = null;
}

export class OrganizationSummary extends Organization {
    @field({ decoder: STBillingStatus })
    billingStatus: STBillingStatus;

    // @field({ decoder: DateDecoder })
    // createdAt: Date;

    @field({ decoder: DateDecoder, nullable: true })
    lastActiveAt: Date | null = null;

    @field({ decoder: OrganizationStats })
    stats: OrganizationStats;

    @field({ decoder: new ArrayDecoder(new EnumDecoder(AcquisitionType)), version: 130 })
    acquisitionTypes: AcquisitionType[] = [];

    @field({ decoder: StringDecoder, nullable: true, version: 154 })
    mollieCustomerId: string | null = null;

    @field({ decoder: new ArrayDecoder(OrganizationPaymentMandate), version: 154 })
    paymentMandates: OrganizationPaymentMandate[] = [];

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    features: string[] = [];
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
    admins: User[];

    @field({ decoder: new ArrayDecoder(OrganizationEmail), version: 90 })
    emails: OrganizationEmail[] = [];

    @field({ decoder: OrganizationStats, version: 90 })
    stats: OrganizationStats;

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    features: string[] = [];

    @field({ decoder: new ArrayDecoder(new EnumDecoder(AcquisitionType)), optional: true })
    acquisitionTypes: AcquisitionType[] = [];

    matchQuery(q: string) {
        if (q === this.id) {
            return true;
        }

        const parts = q.split(/[ -]/);
        const name = Formatter.slug(this.name);
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
