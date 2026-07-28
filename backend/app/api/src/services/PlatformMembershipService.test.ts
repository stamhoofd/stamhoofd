import { MemberFactory, MemberPlatformMembership, OrganizationFactory, Platform, RegistrationFactory, RegistrationPeriodFactory } from '@stamhoofd/models';
import { PlatformMembershipType, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig, PlatformMembershipTypeConfigPrice, ReduceablePrice } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { PlatformMembershipService } from './PlatformMembershipService.js';

describe('PlatformMembershipService.calculatePrice', () => {
    const membershipPrice = 25_00;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
        vitest.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] }).setSystemTime(new Date(2024, 4, 1, 0, 0, 0, 0));
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

    /**
     * Creates a period membership type with a single configured price, and a membership that is
     * ready to be priced. The period has a previous period, which is required to become eligible
     * for a trial.
     */
    async function setupPeriodMembership(options: { trialDays?: number } = {}) {
        const previousPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1, 0, 0, 0, 0),
            endDate: new Date(2023, 11, 31, 23, 59, 59, 0),
        }).create();

        const period = await new RegistrationPeriodFactory({
            startDate: new Date(2024, 0, 1, 0, 0, 0, 0),
            endDate: new Date(2024, 11, 31, 23, 59, 59, 0),
            previousPeriodId: previousPeriod.id,
        }).create();

        const organization = await new OrganizationFactory({ period }).create();
        const member = await new MemberFactory({ organization }).create();

        const membershipType = PlatformMembershipType.create({
            name: 'Period membership',
            behaviour: PlatformMembershipTypeBehaviour.Period,
            periods: new Map([
                [period.id, PlatformMembershipTypeConfig.create({
                    startDate: period.startDate,
                    endDate: period.endDate,
                    trialDays: options.trialDays ?? 0,
                    prices: [
                        PlatformMembershipTypeConfigPrice.create({
                            prices: new Map([['', ReduceablePrice.create({ price: membershipPrice })]]),
                        }),
                    ],
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
        membership.startDate = period.startDate;
        membership.endDate = period.endDate;

        return { member, membership, organization, period };
    }

    test('allows the inclusive maximum number of days', async () => {
        const { member, membership } = await setupDaysMembership(2);
        membership.startDate = new Date(2024, 4, 1, 0, 0, 0, 0);
        membership.endDate = new Date(2024, 4, 2, 0, 0, 0, 0);

        await expect(PlatformMembershipService.calculatePrice(membership, member)).resolves.toBeUndefined();
        expect(membership.maximumFreeAmount).toBe(2);
    });

    test('rejects days memberships that exceed maximum days', async () => {
        const { member, membership } = await setupDaysMembership(2);
        membership.startDate = new Date(2024, 4, 1, 0, 0, 0, 0);
        membership.endDate = new Date(2024, 4, 3, 0, 0, 0, 0);

        await expect(PlatformMembershipService.calculatePrice(membership, member)).rejects.toMatchObject({
            code: 'invalid_field',
            field: 'endDate',
        });
    });

    test('calculates the configured price of a period membership', async () => {
        const { member, membership } = await setupPeriodMembership();

        await expect(PlatformMembershipService.calculatePrice(membership, member)).resolves.toBeUndefined();

        expect(membership.price).toBe(membershipPrice);
        expect(membership.priceWithoutDiscount).toBe(membershipPrice);
        expect(membership.freeAmount).toBe(0);
        expect(membership.maximumFreeAmount).toBe(1);
        expect(membership.trialUntil).toBeNull();
    });

    test('does not recalculate the price of a locked membership', async () => {
        const { member, membership } = await setupPeriodMembership();
        membership.locked = true;
        membership.price = 1_00;
        membership.priceWithoutDiscount = 2_00;

        await expect(PlatformMembershipService.calculatePrice(membership, member)).resolves.toBeUndefined();

        expect(membership.price).toBe(1_00);
        expect(membership.priceWithoutDiscount).toBe(2_00);
    });

    test('rejects a membership with an unknown membership type', async () => {
        const { member, membership } = await setupPeriodMembership();
        membership.membershipTypeId = 'unknown-membership-type';

        await expect(PlatformMembershipService.calculatePrice(membership, member)).rejects.toMatchObject({
            code: 'invalid_membership_type',
        });

        // The price is not silently set to zero
        expect(membership.price).toBe(0);
        expect(membership.priceWithoutDiscount).toBe(0);
    });

    test('grants a trial period only when the member has a registration with a trial', async () => {
        const { member, membership, organization } = await setupPeriodMembership({ trialDays: 14 });

        // Without a registration that had a trial, the member is not eligible for a trial
        await expect(PlatformMembershipService.calculatePrice(membership, member)).resolves.toBeUndefined();
        expect(membership.trialUntil).toBeNull();

        const registration = await new RegistrationFactory({ member, organization }).create();
        registration.trialUntil = new Date(2024, 4, 20, 12, 0, 0, 0);
        await registration.save();

        await expect(PlatformMembershipService.calculatePrice(membership, member)).resolves.toBeUndefined();

        // The trial ends trialDays after the start date of the membership
        expect(membership.trialUntil).not.toBeNull();
        expect(Formatter.dateIso(membership.trialUntil!)).toBe('2024-01-15');
        expect(membership.price).toBe(membershipPrice);
    });
});
