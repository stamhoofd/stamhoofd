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

    // Outside of both period grace windows
    const midPeriod = new Date(2026, 1, 1);
    const removedAfterPeriodStartGrace = new Date(period.startDate.getTime() + PERIOD_GRACE_MS);

    function createRecord(options: { organizationId?: string | null; responsibilityId?: string; startDate?: Date; endDate?: Date | null } = {}) {
        return MemberResponsibilityRecord.create({
            memberId: 'member-id',
            responsibilityId: 'responsibility-id',
            organizationId,
            startDate: new Date(2024, 0, 1),
            ...options,
        });
    }

    function createRegistration(options: {
        organizationId?: string;
        periodId?: string;
        type?: GroupType;
        defaultAgeGroupId?: string | null;
        registeredAt?: Date | null;
        endDate?: Date | null;
        deactivatedAt?: Date | null;
        groupDeletedAt?: Date | null;
    } = {}) {
        const registrationOrganizationId = options.organizationId ?? organizationId;
        return Registration.create({
            organizationId: registrationOrganizationId,
            group: Group.create({
                organizationId: registrationOrganizationId,
                periodId: options.periodId ?? period.id,
                type: options.type ?? GroupType.Membership,
                defaultAgeGroupId: options.defaultAgeGroupId ?? null,
                deletedAt: options.groupDeletedAt ?? null,
            }),
            groupPrice: GroupPrice.create({}),
            registeredAt: options.registeredAt === undefined ? new Date(2025, 8, 5) : options.registeredAt,
            endDate: options.endDate === undefined ? period.endDate : options.endDate,
            deactivatedAt: options.deactivatedAt ?? null,
        });
    }

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        vi.useFakeTimers();
        vi.setSystemTime(midPeriod);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('records that are never removed', () => {
        test('records without organization', () => {
            expect(createRecord({ organizationId: null }).getAutoRemoveDate([], period, [])).toBeNull();
        });

        test('records that already ended or did not start yet', () => {
            expect(createRecord({ endDate: new Date(2026, 0, 1) }).getAutoRemoveDate([], period, [])).toBeNull();
            expect(createRecord({ startDate: new Date(2026, 5, 1) }).getAutoRemoveDate([], period, [])).toBeNull();
        });

        test('records of members with an active registration in the current period', () => {
            expect(createRecord().getAutoRemoveDate([createRegistration()], period, [])).toBeNull();
            expect(createRecord().getAutoRemoveDate([createRegistration({ endDate: null })], period, [])).toBeNull();
        });
    });

    describe('removal date', () => {
        test('is at least 14 days after the responsibility started', () => {
            const startDate = new Date(midPeriod.getTime() - 1000 * 60 * 60 * 24);
            const expected = new Date(startDate.getTime() + AUTO_REMOVE_GRACE_MS);

            expect(createRecord({ startDate }).getAutoRemoveDate([], period, [])).toEqual(expected);
            expect(createRecord({ startDate }).getAutoRemoveDate([createRegistration({ deactivatedAt: new Date(2026, 0, 10) })], period, [])).toEqual(expected);
        });

        test('ignores registrations in other organizations, other periods, non-membership groups and unconfirmed registrations', () => {
            const registrations = [
                createRegistration({ organizationId: 'other-organization-id' }),
                createRegistration({ periodId: 'other-period-id' }),
                createRegistration({ type: GroupType.EventRegistration }),
                createRegistration({ registeredAt: null }),
            ];
            expect(createRecord().getAutoRemoveDate(registrations, period, [])).toEqual(removedAfterPeriodStartGrace);
        });

        test('is 14 days after the latest ended, deactivated or deleted registration', () => {
            const ended = new Date(2026, 0, 10);
            const deactivated = new Date(2026, 0, 15);
            const groupDeleted = new Date(2026, 0, 20);

            expect(createRecord().getAutoRemoveDate([createRegistration({ endDate: ended })], period, [])).toEqual(new Date(ended.getTime() + AUTO_REMOVE_GRACE_MS));
            expect(createRecord().getAutoRemoveDate([createRegistration({ deactivatedAt: deactivated })], period, [])).toEqual(new Date(deactivated.getTime() + AUTO_REMOVE_GRACE_MS));
            expect(createRecord().getAutoRemoveDate([createRegistration({ endDate: null, groupDeletedAt: groupDeleted })], period, [])).toEqual(new Date(groupDeleted.getTime() + AUTO_REMOVE_GRACE_MS));

            const all = [
                createRegistration({ endDate: ended }),
                createRegistration({ endDate: null, groupDeletedAt: groupDeleted }),
                createRegistration({ deactivatedAt: deactivated }),
            ];
            expect(createRecord().getAutoRemoveDate(all, period, [])).toEqual(new Date(groupDeleted.getTime() + AUTO_REMOVE_GRACE_MS));
        });
    });

    describe('period grace windows', () => {
        test('keeps the responsibility until 60 days after the start of the current period', () => {
            // Without registrations, and with a registration that ended shortly after the start
            expect(createRecord().getAutoRemoveDate([], period, [])).toEqual(removedAfterPeriodStartGrace);
            expect(createRecord().getAutoRemoveDate([createRegistration({ deactivatedAt: new Date(2025, 8, 10) })], period, [])).toEqual(removedAfterPeriodStartGrace);
        });

        test('keeps the responsibility until 60 days after the period ended when the organization did not switch yet', () => {
            vi.setSystemTime(new Date(2026, 8, 20));
            expect(createRecord().getAutoRemoveDate([createRegistration()], period, [])).toEqual(new Date(period.endDate.getTime() + PERIOD_GRACE_MS));
        });

        test('keeps the responsibility until 60 days after the start of a new period', () => {
            vi.setSystemTime(new Date(2026, 8, 20));
            expect(createRecord().getAutoRemoveDate([createRegistration()], nextPeriod, [])).toEqual(new Date(nextPeriod.startDate.getTime() + PERIOD_GRACE_MS));
        });
    });

    describe('platform responsibilities', () => {
        const platformResponsibilityId = 'platform-responsibility-id';

        beforeEach(() => {
            TestUtils.setEnvironment('userMode', 'platform');
        });

        test('are only kept by registrations in groups linked to a default age group', () => {
            const record = createRecord({ responsibilityId: platformResponsibilityId });
            expect(record.getAutoRemoveDate([createRegistration({ defaultAgeGroupId: 'default-age-group-id' })], period, [platformResponsibilityId])).toBeNull();
            expect(record.getAutoRemoveDate([createRegistration()], period, [platformResponsibilityId])).toEqual(removedAfterPeriodStartGrace);
        });

        test('organization responsibilities are also kept by groups without a default age group', () => {
            expect(createRecord().getAutoRemoveDate([createRegistration()], period, [platformResponsibilityId])).toBeNull();
        });
    });
});
