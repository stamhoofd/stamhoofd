import type { XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { isXlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { Group, GroupPrice, GroupSettings, GroupType, JudicialRecordHelper, JudicialRecordStatus, MemberDetails, MemberResponsibility, MemberResponsibilityRecord, MemberWithRegistrationsBlob, Organization, Platform, PlatformConfig, PlatformRegistration, Registration, RegistrationPeriod, RegistrationsBlob, RegistrationWithMemberBlob } from '@stamhoofd/structures';
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

        const [registration] = PlatformRegistration.createSingles(RegistrationsBlob.create({
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

    it('shows the judicial record status of the member', () => {
        const period = RegistrationPeriod.create({ startDate: new Date('2025-09-01T00:00:00Z'), endDate: new Date('2026-08-31T00:00:00Z') });
        const organization = Organization.create({ name: 'Group A', uri: 'A' });
        const responsibility = MemberResponsibility.create({ name: 'Leiding', judicialRecordMinimumAge: 18 });
        const platform = Platform.create({ period, config: PlatformConfig.create({ responsibilities: [responsibility] }) });

        const registration = Registration.create({
            organizationId: organization.id,
            group: Group.create({ organizationId: organization.id, periodId: period.id, type: GroupType.Membership, settings: GroupSettings.create({ period }) }),
            groupPrice: GroupPrice.create({}),
            registeredAt: new Date('2025-09-15T00:00:00Z'),
        });

        const member = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({ birthDay: new Date('1990-01-01T00:00:00Z') }),
            registrations: [registration],
        });
        member.responsibilities = [MemberResponsibilityRecord.create({
            memberId: member.id,
            organizationId: organization.id,
            responsibilityId: responsibility.id,
            startDate: new Date('2025-09-01T00:00:00Z'),
        })];

        const [platformRegistration] = PlatformRegistration.createSingles(RegistrationsBlob.create({
            registrations: [RegistrationWithMemberBlob.create({ ...registration, member })],
            organizations: [organization],
        }), { platform });

        const columns = getSheet(platform).columns.filter(c => isXlsxTransformerConcreteColumn(c) && c.id === 'member.judicialRecordStatus') as XlsxTransformerConcreteColumn<PlatformRegistration>[];
        expect(columns).toHaveLength(1);
        expect(columns[0].getValue(platformRegistration).value).toBe(JudicialRecordHelper.getStatusName(JudicialRecordStatus.Required));
    });
});
