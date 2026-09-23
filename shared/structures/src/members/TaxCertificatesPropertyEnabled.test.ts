import { PropertyFilter } from '../filters/PropertyFilter.js';
import { Group } from '../Group.js';
import { GroupPrice, GroupSettings } from '../GroupSettings.js';
import { Organization } from '../Organization.js';
import { PermissionLevel } from '../PermissionLevel.js';
import { Permissions } from '../Permissions.js';
import { Platform } from '../Platform.js';
import { UserPermissions } from '../UserPermissions.js';
import { UserWithMembers } from '../UserWithMembers.js';
import { MemberDetails } from './MemberDetails.js';
import { MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob.js';
import { NationalRegisterNumberOptOut } from './NationalRegisterNumberOptOut.js';
import { OrganizationRecordsConfiguration } from './OrganizationRecordsConfiguration.js';
import type { Parent } from './Parent.js';
import { PlatformFamily, PlatformMember } from './PlatformMember.js';
import { Registration } from './Registration.js';

function yearsAgo(years: number) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    return date;
}

/**
 * A member of an organization (userMode organization) registered a year ago, so the age
 * at that registration decides whether a certificate is needed.
 */
function build({ age, taxCertificates = true, nationalRegisterNumberFilter = null, nationalRegisterNumber = null, parents = [] }: {
    age: number;
    taxCertificates?: boolean;
    /** The plain national register number question of the organization */
    nationalRegisterNumberFilter?: PropertyFilter | null;
    nationalRegisterNumber?: string | typeof NationalRegisterNumberOptOut | null;
    parents?: Parent[];
}) {
    const organization = Organization.create({});
    organization.meta.recordsConfiguration = OrganizationRecordsConfiguration.create({
        taxCertificates,
        nationalRegisterNumber: nationalRegisterNumberFilter,
    });

    const registeredAt = yearsAgo(1);
    const member = MemberWithRegistrationsBlob.create({
        organizationId: organization.id,
        registrations: [Registration.create({
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
            firstName: 'Child',
            lastName: 'Doe',
            // Registered a year ago, so subtract a year to get the age at that registration
            birthDay: yearsAgo(age + 1),
            nationalRegisterNumber,
            parents,
        }),
    });

    const family = new PlatformFamily({ platform: Platform.create({}), contextOrganization: organization });
    const platformMember = new PlatformMember({ member, family });
    family.members.push(platformMember);

    return { member: platformMember, organization };
}

function adminOptions(organization: Organization, level: PermissionLevel) {
    const user = UserWithMembers.create({
        email: 'admin@example.com',
        permissions: UserPermissions.create({
            organizationPermissions: new Map([[organization.id, Permissions.create({ level })]]),
        }),
    });
    return { checkPermissions: { user, level: PermissionLevel.Write } };
}

describe('PlatformMember tax certificate properties', () => {
    describe("isPropertyEnabled('taxCertificates')", () => {
        test('false when the organization did not enable it, even if the member needs a certificate', () => {
            const { member } = build({ age: 10, taxCertificates: false });
            expect(member.isPropertyEnabled('taxCertificates')).toBe(false);
        });

        test('true when enabled and the member needs a certificate', () => {
            const { member } = build({ age: 10 });
            expect(member.isPropertyEnabled('taxCertificates')).toBe(true);
        });

        test('false when the member is too old and nobody can override it', () => {
            const { member } = build({ age: 17 });
            expect(member.isPropertyEnabled('taxCertificates')).toBe(false);
        });

        test('a full admin can still collect it for a member under 22', () => {
            const { member, organization } = build({ age: 17 });
            expect(member.isPropertyEnabled('taxCertificates', adminOptions(organization, PermissionLevel.Full))).toBe(true);
        });

        test('a full admin cannot collect it for a member of 22 or older', () => {
            const { member, organization } = build({ age: 22 });
            expect(member.isPropertyEnabled('taxCertificates', adminOptions(organization, PermissionLevel.Full))).toBe(false);
        });

        test('an admin without full access cannot override the age', () => {
            const { member, organization } = build({ age: 17 });
            expect(member.isPropertyEnabled('taxCertificates', adminOptions(organization, PermissionLevel.Write))).toBe(false);
        });

        test('the override does not apply when the organization did not enable it', () => {
            const { member, organization } = build({ age: 17, taxCertificates: false });
            expect(member.isPropertyEnabled('taxCertificates', adminOptions(organization, PermissionLevel.Full))).toBe(false);
        });
    });

    describe("isPropertyEnabled('parents.nationalRegisterNumber')", () => {
        test('follows the tax certificate setting', () => {
            expect(build({ age: 10 }).member.isPropertyEnabled('parents.nationalRegisterNumber')).toBe(true);
            expect(build({ age: 10, taxCertificates: false }).member.isPropertyEnabled('parents.nationalRegisterNumber')).toBe(false);
            expect(build({ age: 17 }).member.isPropertyEnabled('parents.nationalRegisterNumber')).toBe(false);
        });

        test('false when the member opted out of a national register number', () => {
            const { member } = build({ age: 10, nationalRegisterNumber: NationalRegisterNumberOptOut });
            expect(member.isPropertyEnabled('parents.nationalRegisterNumber')).toBe(false);
            expect(member.isPropertyEnabled('parents.isMemberTaxDependent')).toBe(false);
        });

        test('enabled through the full admin override', () => {
            const { member, organization } = build({ age: 17 });
            expect(member.isPropertyEnabled('parents.nationalRegisterNumber', adminOptions(organization, PermissionLevel.Full))).toBe(true);
        });

        test('the plain national register number question does not enable it', () => {
            const { member } = build({ age: 10, taxCertificates: false, nationalRegisterNumberFilter: PropertyFilter.createDefault() });
            expect(member.isPropertyEnabled('parents.nationalRegisterNumber')).toBe(false);
        });
    });

    describe("isPropertyEnabled('nationalRegisterNumber')", () => {
        test('asked for the certificate even when the plain question is off', () => {
            const { member } = build({ age: 10 });
            expect(member.isPropertyEnabled('nationalRegisterNumber')).toBe(true);
        });

        test('falls back to the plain question when no certificate is needed', () => {
            expect(build({ age: 17 }).member.isPropertyEnabled('nationalRegisterNumber')).toBe(false);
            expect(build({ age: 17, nationalRegisterNumberFilter: PropertyFilter.createDefault() }).member.isPropertyEnabled('nationalRegisterNumber')).toBe(true);
        });

        test('asked through the full admin override', () => {
            const { member, organization } = build({ age: 17 });
            expect(member.isPropertyEnabled('nationalRegisterNumber', adminOptions(organization, PermissionLevel.Full))).toBe(true);
        });
    });

    describe('isPropertyRequired', () => {
        test('the numbers of the member and the parent are required when a certificate is needed', () => {
            const { member } = build({ age: 10 });
            expect(member.isPropertyRequired('nationalRegisterNumber')).toBe(true);
            expect(member.isPropertyRequired('parents.nationalRegisterNumber')).toBe(true);
        });

        test('ticking a parent as debtor is never required', () => {
            const { member } = build({ age: 10 });
            expect(member.isPropertyRequired('parents.isMemberTaxDependent')).toBe(false);
            expect(member.isPropertyRequired('taxCertificates')).toBe(false);
        });

        test('nothing is required through the full admin override', () => {
            const { member, organization } = build({ age: 17 });
            const options = adminOptions(organization, PermissionLevel.Full);
            expect(member.isPropertyRequired('nationalRegisterNumber', options)).toBe(false);
            expect(member.isPropertyRequired('parents.nationalRegisterNumber', options)).toBe(false);
        });

        test('nothing is required after opting out', () => {
            const { member } = build({ age: 10, nationalRegisterNumber: NationalRegisterNumberOptOut });
            expect(member.isPropertyRequired('nationalRegisterNumber')).toBe(false);
            expect(member.isPropertyRequired('parents.nationalRegisterNumber')).toBe(false);
        });
    });
});
