import { PlatformMembershipType, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig } from '@stamhoofd/structures';

import { MemberFactory } from '../factories/MemberFactory.js';
import { OrganizationFactory } from '../factories/OrganizationFactory.js';
import { RegistrationPeriodFactory } from '../factories/RegistrationPeriodFactory.js';
import { MemberPlatformMembership } from './MemberPlatformMembership.js';
import { Platform } from './Platform.js';

describe('MemberPlatformMembership', () => {
    beforeEach(() => {
        vitest.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date(2024, 4, 1, 0, 0, 0, 0));
    });

    afterEach(() => {
        vitest.useRealTimers();
    });

    async function setupDaysMembership(maximumDays: number) {
        const period = await new RegistrationPeriodFactory({
            startDate: new Date(2024, 0, 1, 0, 0, 0, 0),
            endDate: new Date(2024, 11, 31, 23, 59, 59, 999),
        }).create();
        const organization = await new OrganizationFactory({ period }).create();
        const member = await new MemberFactory({ organization }).create();
        const membershipType = PlatformMembershipType.create({
            name: 'Days membership',
            behaviour: PlatformMembershipTypeBehaviour.Days,
            periods: new Map([
                [period.id, PlatformMembershipTypeConfig.create({
                    startDate: period.startDate,
                    endDate: period.endDate,
                    maximumDays,
                })],
            ]),
        });

        const platform = await Platform.getForEditing();
        platform.periodId = period.id;
        platform.config.membershipTypes = [membershipType];
        await platform.save();

        const membership = new MemberPlatformMembership();
        membership.memberId = member.id;
        membership.membershipTypeId = membershipType.id;
        membership.organizationId = organization.id;
        membership.periodId = period.id;

        return { member, membership };
    }

    test('allows the inclusive maximum number of days', async () => {
        const { member, membership } = await setupDaysMembership(2);
        membership.startDate = new Date(2024, 4, 1, 0, 0, 0, 0);
        membership.endDate = new Date(2024, 4, 2, 0, 0, 0, 0);

        await expect(membership.calculatePrice(member)).resolves.toBeUndefined();
        expect(membership.maximumFreeAmount).toBe(2);
    });

    test('rejects days memberships that exceed maximum days', async () => {
        const { member, membership } = await setupDaysMembership(2);
        membership.startDate = new Date(2024, 4, 1, 0, 0, 0, 0);
        membership.endDate = new Date(2024, 4, 3, 0, 0, 0, 0);

        await expect(membership.calculatePrice(member)).rejects.toMatchObject({
            code: 'invalid_field',
            field: 'endDate',
        });
    });
});
