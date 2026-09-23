import type { NationalRegisterNumberOptOut, Parent } from '@stamhoofd/structures';
import { Address, BooleanStatus, Group, GroupPrice, GroupSettings, MemberDetails, MemberWithRegistrationsBlob, Organization, OrganizationRecordsConfiguration, Platform, PlatformFamily, PlatformMember, PropertyFilter, Registration } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { reactive } from 'vue';

export type TaxCertificateMemberOptions = {
    /** Age at the registration of a year ago; under 14 needs a certificate */
    age?: number;
    /** Overrides the age, for a number that has to match the birth day */
    birthDay?: Date;
    /** Whether the organization collects data for tax certificates */
    taxCertificates?: boolean;
    /** Whether the organization asks the plain national register number question */
    nationalRegisterNumberEnabled?: boolean;
    nationalRegisterNumber?: string | typeof NationalRegisterNumberOptOut | null;
    severeDisability?: boolean | null;
    parents?: Parent[];
    isNew?: boolean;
    /** Leave out the registration, so no certificate is needed */
    withRegistration?: boolean;
};

export function yearsAgo(years: number) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    return date;
}

/**
 * A member of an organization (userMode organization) that registered a year ago. The member is
 * reactive, like the clone a member step holds, so patches made by a component re-render it.
 */
export function createTaxCertificateMember(options: TaxCertificateMemberOptions = {}) {
    const platform = Platform.create({});
    const organization = Organization.create({});
    organization.meta.recordsConfiguration = OrganizationRecordsConfiguration.create({
        taxCertificates: options.taxCertificates ?? true,
        nationalRegisterNumber: options.nationalRegisterNumberEnabled ? PropertyFilter.createDefault() : null,
    });

    const family = new PlatformFamily({ platform, contextOrganization: organization });
    const registeredAt = yearsAgo(1);

    const member = new PlatformMember({
        family,
        isNew: options.isNew,
        member: MemberWithRegistrationsBlob.create({
            organizationId: organization.id,
            registrations: options.withRegistration === false
                ? []
                : [Registration.create({
                        registeredAt,
                        startDate: registeredAt,
                        organizationId: organization.id,
                        groupPrice: GroupPrice.create({}),
                        group: Group.create({
                            organizationId: organization.id,
                            settings: GroupSettings.create({}),
                            periodId: 'period',
                        }),
                    })],
            details: MemberDetails.create({
                firstName: 'Jan',
                lastName: 'Peeters',
                address: Address.create({
                    city: 'Brussel',
                    country: Country.Belgium,
                    number: '1',
                    postalCode: '1000',
                    street: 'Wetstraat',
                }),
                // Registered a year ago, so subtract a year to get the age at that registration
                birthDay: options.birthDay ?? yearsAgo((options.age ?? 10) + 1),
                nationalRegisterNumber: options.nationalRegisterNumber ?? null,
                severeDisability: options.severeDisability === undefined || options.severeDisability === null ? null : BooleanStatus.create({ value: options.severeDisability }),
                parents: options.parents ?? [],
            }),
        }),
    });
    family.add(member);

    return { member: reactive(member) as PlatformMember, organization };
}
