import {
    Group,
    GroupPrice,
    GroupType,
    MemberWithRegistrationsBlob,
    Organization,
    OrganizationRegistrationPeriod,
    Registration,
    RegistrationPeriod,
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
});
