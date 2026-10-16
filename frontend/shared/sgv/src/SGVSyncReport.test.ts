import {
    Group,
    GroupPrice,
    GroupSettings,
    GroupType,
    MemberDetails,
    MemberWithRegistrationsBlob,
    Organization,
    OrganizationRegistrationPeriod,
    Registration,
    RegistrationPeriod,
    TranslatedString,
} from '@stamhoofd/structures';
import { isMemberManaged } from './SGVSyncReport';

describe('SGVSyncReport.isMemberManaged', () => {
    function createOrganization() {
        return Organization.create({
            period: OrganizationRegistrationPeriod.create({
                period: RegistrationPeriod.create({ id: 'period-id' }),
            }),
        });
    }

    function createGroup(type = GroupType.Membership, periodId = 'period-id') {
        return Group.create({
            id: `${type}-${periodId}`,
            type,
            periodId,
            settings: GroupSettings.create({ name: TranslatedString.create('Kapoenen') }),
        });
    }

    function createMember({
        registeredAt = new Date(2026, 5, 1, 12),
        group = createGroup(),
    }: {
        registeredAt?: Date | null;
        group?: Group;
    } = {}) {
        return MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({ birthDay: new Date(1990, 0, 1) }),
            registrations: [Registration.create({
                group,
                groupPrice: GroupPrice.create({}),
                registeredAt,
                deactivatedAt: null,
            })],
        });
    }

    test('detects members managed by SGV sync', () => {
        const organization = createOrganization();

        expect(isMemberManaged(createMember(), organization)).toBe(true);
        expect(isMemberManaged(createMember({ group: createGroup(GroupType.EventRegistration) }), organization)).toBe(false);
        expect(isMemberManaged(createMember({ registeredAt: null }), organization)).toBe(false);
    });

    test('ignores registrations from other periods', () => {
        const organization = createOrganization();

        expect(isMemberManaged(createMember({ group: createGroup(GroupType.Membership, 'other-period') }), organization)).toBe(false);
    });

    test('ignores registrations from previous active work years', () => {
        const organization = createOrganization();
        organization.period.period.startDate = new Date();
        organization.period.period.previousPeriodId = 'previous-period';

        expect(isMemberManaged(createMember({ group: createGroup(GroupType.Membership, 'previous-period') }), organization)).toBe(false);
    });
});
