import { TestUtils } from '@stamhoofd/test-utils';
import { Group } from '../Group.js';
import { GroupPrice } from '../GroupSettings.js';
import { GroupType } from '../GroupType.js';
import { AUTO_REMOVE_GRACE_MS, MemberResponsibilityRecord, PERIOD_GRACE_MS } from './MemberResponsibilityRecord.js';
import { Registration } from './Registration.js';

describe('MemberResponsibilityRecord.getAutoRemoveDate', () => {
    const organizationId = 'organization-id';
    const period = { id: 'period-2025', startDate: new Date(2025, 8, 1), endDate: new Date(2026, 7, 31, 23, 59, 59) };
    const nextPeriod = { id: 'period-2026', startDate: new Date(2026, 8, 1), endDate: new Date(2027, 7, 31, 23, 59, 59) };

    const record = MemberResponsibilityRecord.create({
        memberId: 'member-id',
        responsibilityId: 'responsibility-id',
        organizationId,
        startDate: new Date(2024, 0, 1),
    });

    function createRegistration({ periodId = period.id, endDate = period.endDate, deactivatedAt = null }: { periodId?: string; endDate?: Date | null; deactivatedAt?: Date | null } = {}) {
        return Registration.create({
            organizationId,
            group: Group.create({ organizationId, periodId, type: GroupType.Membership }),
            groupPrice: GroupPrice.create({}),
            registeredAt: new Date(2025, 8, 5),
            endDate,
            deactivatedAt,
        });
    }

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('keeps the responsibility while a registration in the current period is active', () => {
        vi.setSystemTime(new Date(2026, 2, 1));
        expect(record.getAutoRemoveDate([createRegistration()], period, [])).toBeNull();
    });

    test('keeps the responsibility until 60 days after the period ended when the organization did not switch yet', () => {
        vi.setSystemTime(new Date(2026, 8, 20));
        expect(record.getAutoRemoveDate([createRegistration()], period, [])).toEqual(new Date(period.endDate.getTime() + PERIOD_GRACE_MS));
    });

    test('keeps the responsibility until 60 days after the start of a new period', () => {
        vi.setSystemTime(new Date(2026, 8, 20));
        expect(record.getAutoRemoveDate([createRegistration()], nextPeriod, [])).toEqual(new Date(nextPeriod.startDate.getTime() + PERIOD_GRACE_MS));
    });

    test('removes the responsibility 14 days after a registration is deactivated during the period', () => {
        vi.setSystemTime(new Date(2026, 1, 1));
        const deactivatedAt = new Date(2026, 0, 10);
        expect(record.getAutoRemoveDate([createRegistration({ deactivatedAt })], period, [])).toEqual(new Date(deactivatedAt.getTime() + AUTO_REMOVE_GRACE_MS));
    });
});
