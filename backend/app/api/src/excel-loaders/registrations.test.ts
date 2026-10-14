import type { XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { isXlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import type { PlatformRegistration } from '@stamhoofd/structures';
import { Group, GroupPrice, GroupSettings, GroupType, MemberDetails, MemberWithRegistrationsBlob, Organization, Platform, Registration, RegistrationPeriod, RegistrationsBlob, RegistrationWithMemberBlob } from '@stamhoofd/structures';
import { PlatformFamilyHelper } from '@stamhoofd/structures/helpers/PlatformFamilyHelper.js';
import { getSheet } from './registrations.js';

describe('Registrations excel export', () => {
    it('shows the organizer of the registration and the primary organization of the member', () => {
        const period = RegistrationPeriod.create({ startDate: new Date('2025-09-01T00:00:00Z'), endDate: new Date('2026-08-31T00:00:00Z') });
        const national = Organization.create({ name: 'National', uri: 'NAT' });
        const groupA = Organization.create({ name: 'Group A', uri: 'A' });
        const platform = Platform.create({ period, membershipOrganizationId: national.id });

        const createRegistration = (organization: Organization, type: GroupType) => Registration.create({
            organizationId: organization.id,
            group: Group.create({ organizationId: organization.id, periodId: period.id, type, settings: GroupSettings.create({ period }) }),
            groupPrice: GroupPrice.create({}),
            registeredAt: new Date('2025-09-15T00:00:00Z'),
        });

        const event = createRegistration(national, GroupType.EventRegistration);
        const member = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({}),
            registrations: [event, createRegistration(groupA, GroupType.Membership)],
        });

        const [registration] = PlatformFamilyHelper.createRegistrationSingles(RegistrationsBlob.create({
            registrations: [RegistrationWithMemberBlob.create({ ...event, member })],
            organizations: [national, groupA],
        }), { platform });

        const sheet = getSheet(platform);
        const getValue = (id: string) => {
            const columns = sheet.columns.filter(c => isXlsxTransformerConcreteColumn(c) && c.id === id) as XlsxTransformerConcreteColumn<PlatformRegistration>[];
            expect(columns).toHaveLength(1);
            return columns[0].getValue(registration).value;
        };

        expect(getValue('organization')).toBe('National');
        expect(getValue('uri')).toBe('NAT');
        expect(getValue('member.organization')).toBe('Group A');
        expect(getValue('member.uri')).toBe('A');
    });
});
