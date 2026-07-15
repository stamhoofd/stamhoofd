import { Request } from '@simonbackx/simple-endpoints';
import type { Member, Organization, RegistrationPeriod, Token } from '@stamhoofd/models';
import { MemberFactory, MemberPlatformMembership, OrganizationFactory, Platform, RegistrationPeriodFactory } from '@stamhoofd/models';
import { TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initPlatformAdmin } from '../../../../tests/init/index.js';
import { GetChargeMembershipsSummaryEndpoint } from './GetChargeMembershipsSummaryEndpoint.js';

describe('Endpoint.GetChargeMembershipsSummary', () => {
    const endpoint = new GetChargeMembershipsSummaryEndpoint();
    const membershipPrice = 25_00;

    let currentPeriod: RegistrationPeriod;
    let nextPeriod: RegistrationPeriod;
    let membershipOrganization: Organization;
    let payingOrganization: Organization;

    const getSummary = async (token: Token) => {
        const request = Request.get({
            path: '/admin/charge-memberships/summary',
            // Platform admins are not scoped to an organization, so no host is required
            host: '',
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        const response = await testServer.test(endpoint, request);
        return response.body;
    };

    // Creates an uncharged (not yet invoiced) membership that should show up in the summary
    const createUnchargedMembership = async (period: RegistrationPeriod, organization: Organization, member: Member) => {
        const membership = new MemberPlatformMembership();
        membership.memberId = member.id;
        membership.membershipTypeId = uuidv4();
        membership.organizationId = organization.id;
        membership.periodId = period.id;
        membership.startDate = period.startDate;
        membership.endDate = period.endDate;
        membership.price = membershipPrice;
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

        const platform = await Platform.getForEditing();
        platform.periodId = currentPeriod.id;
        platform.nextPeriodId = nextPeriod.id;
        platform.membershipOrganizationId = membershipOrganization.id;
        await platform.save();
    });

    test('Excludes next period memberships from the charge summary total', async () => {
        const { adminToken } = await initPlatformAdmin();

        // Use deltas relative to a baseline, so the test is robust to memberships created elsewhere
        const before = await getSummary(adminToken);

        // A membership in the next period should not be counted
        const nextMember = await new MemberFactory({}).create();
        await createUnchargedMembership(nextPeriod, payingOrganization, nextMember);

        const afterNextPeriod = await getSummary(adminToken);
        expect(afterNextPeriod.memberships).toBe(before.memberships);
        expect(afterNextPeriod.price).toBe(before.price);

        // A membership in the current period should be counted
        const currentMember = await new MemberFactory({}).create();
        await createUnchargedMembership(currentPeriod, payingOrganization, currentMember);

        const afterCurrentPeriod = await getSummary(adminToken);
        expect(afterCurrentPeriod.memberships).toBe(before.memberships + 1);
        expect(afterCurrentPeriod.price).toBe(before.price + membershipPrice);
    });
});
