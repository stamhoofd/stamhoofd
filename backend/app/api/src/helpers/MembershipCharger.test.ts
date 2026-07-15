import type { Member, Organization, RegistrationPeriod } from '@stamhoofd/models';
import { BalanceItem, MemberFactory, MemberPlatformMembership, OrganizationFactory, Platform, RegistrationPeriodFactory } from '@stamhoofd/models';
import { BalanceItemType, PlatformMembershipType, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig, PlatformMembershipTypeConfigPrice, ReduceablePrice } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { MembershipCharger } from './MembershipCharger.js';

describe('MembershipCharger', () => {
    const membershipPrice = 25_00;

    let currentPeriod: RegistrationPeriod;
    let nextPeriod: RegistrationPeriod;
    let membershipOrganization: Organization;
    let payingOrganization: Organization;
    let membershipType: PlatformMembershipType;

    const buildConfig = (period: RegistrationPeriod) => {
        return PlatformMembershipTypeConfig.create({
            startDate: period.startDate,
            endDate: period.endDate,
            prices: [
                PlatformMembershipTypeConfigPrice.create({
                    prices: new Map([['', ReduceablePrice.create({ price: membershipPrice })]]),
                }),
            ],
        });
    };

    // Set the period that should not be charged yet (or null to charge every period)
    const setNextPeriod = async (nextPeriodId: string | null) => {
        const platform = await Platform.getForEditing();
        platform.periodId = currentPeriod.id;
        platform.nextPeriodId = nextPeriodId;
        platform.membershipOrganizationId = membershipOrganization.id;
        platform.config.membershipTypes = [membershipType];
        await platform.save();
    };

    const createMembership = async (period: RegistrationPeriod, organization: Organization, member: Member) => {
        const membership = new MemberPlatformMembership();
        membership.memberId = member.id;
        membership.membershipTypeId = membershipType.id;
        membership.organizationId = organization.id;
        membership.periodId = period.id;
        membership.startDate = period.startDate;
        membership.endDate = period.endDate;
        await membership.save();
        return membership;
    };

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'platform');

        currentPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(2024, 0, 1, 0, 0, 0, 0),
            endDate: new Date(2024, 11, 31, 23, 59, 59, 0),
        }).create();

        nextPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(2025, 0, 1, 0, 0, 0, 0),
            endDate: new Date(2025, 11, 31, 23, 59, 59, 0),
        }).create();

        membershipOrganization = await new OrganizationFactory({}).create();
        payingOrganization = await new OrganizationFactory({}).create();

        membershipType = PlatformMembershipType.create({
            name: 'Test membership',
            behaviour: PlatformMembershipTypeBehaviour.Period,
            periods: new Map([
                [currentPeriod.id, buildConfig(currentPeriod)],
                [nextPeriod.id, buildConfig(nextPeriod)],
            ]),
        });
    });

    test('Charges current period memberships but skips memberships of the next period', async () => {
        await setNextPeriod(nextPeriod.id);

        const currentMember = await new MemberFactory({}).create();
        const nextMember = await new MemberFactory({}).create();

        const currentMembership = await createMembership(currentPeriod, payingOrganization, currentMember);
        const nextMembership = await createMembership(nextPeriod, payingOrganization, nextMember);

        await MembershipCharger.charge();

        const chargedCurrent = await MemberPlatformMembership.getByID(currentMembership.id);
        expect(chargedCurrent).toBeDefined();
        expect(chargedCurrent!.balanceItemId).not.toBeNull();
        expect(chargedCurrent!.locked).toBe(true);

        // The next period membership should be left untouched
        const chargedNext = await MemberPlatformMembership.getByID(nextMembership.id);
        expect(chargedNext).toBeDefined();
        expect(chargedNext!.balanceItemId).toBeNull();
        expect(chargedNext!.locked).toBe(false);

        // The created balance item should be charged via the membership organization
        const balanceItem = await BalanceItem.getByID(chargedCurrent!.balanceItemId!);
        expect(balanceItem).toBeDefined();
        expect(balanceItem!.type).toBe(BalanceItemType.PlatformMembership);
        expect(balanceItem!.unitPrice).toBe(membershipPrice);
        expect(balanceItem!.organizationId).toBe(membershipOrganization.id);
        expect(balanceItem!.payingOrganizationId).toBe(payingOrganization.id);
    });
});
