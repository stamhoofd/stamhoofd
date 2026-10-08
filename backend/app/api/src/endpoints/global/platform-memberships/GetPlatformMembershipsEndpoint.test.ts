import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, RegistrationPeriod } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, MemberPlatformMembership, OrganizationFactory, RegistrationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { CountFilteredRequest, LimitedFilteredRequest, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { GetPlatformMembershipsCountEndpoint } from './GetPlatformMembershipsCountEndpoint.js';
import { GetPlatformMembershipsEndpoint } from './GetPlatformMembershipsEndpoint.js';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';

const baseUrl = '/platform-memberships';
const platformHost = 'platform.stamhoofd.app';
const endpoint = new GetPlatformMembershipsEndpoint();
const countEndpoint = new GetPlatformMembershipsCountEndpoint();

describe('Endpoint.GetPlatformMembershipsEndpoint', () => {
    let period: RegistrationPeriod;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();
    });

    async function createMembership({ memberId, organization }: { memberId: string; organization: Organization }) {
        const membership = new MemberPlatformMembership();
        membership.memberId = memberId;
        membership.membershipTypeId = uuidv4();
        membership.organizationId = organization.id;
        membership.periodId = period.id;
        membership.startDate = period.startDate;
        membership.endDate = period.endDate;
        membership.price = 3000;
        membership.priceWithoutDiscount = 4000;
        await membership.save();
        return membership;
    }

    test('Can filter on the organization and member of a membership', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        const otherOrganization = await new OrganizationFactory({ period }).create();
        const member = await new MemberFactory({}).create();
        const otherMember = await new MemberFactory({}).create();

        const membership = await createMembership({ memberId: member.id, organization });
        const otherOrganizationMembership = await createMembership({ memberId: member.id, organization: otherOrganization });
        await createMembership({ memberId: otherMember.id, organization });

        const user = await new UserFactory({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);

        const fetchIds = async (filter: StamhoofdFilter) => {
            const response = await testServer.test(endpoint, Request.get({
                path: baseUrl,
                host: platformHost,
                query: new LimitedFilteredRequest({ filter, limit: 10 }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            }));
            expect(response.status).toBe(200);
            return response.body.results.map(m => m.id);
        };

        const memberFilter = { member: { id: member.id } };

        expect(await fetchIds({ ...memberFilter, organizationId: organization.id })).toEqual([membership.id]);
        expect(await fetchIds({ ...memberFilter, organization: { name: organization.name } })).toEqual([membership.id]);
        expect(await fetchIds(memberFilter)).toIncludeSameMembers([membership.id, otherOrganizationMembership.id]);
    });

    test('An organization admin only gets the memberships of their own organization', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        const otherOrganization = await new OrganizationFactory({ period }).create();

        // Registered in both organizations, so the admin can access this member
        const member = await new MemberFactory({}).create();
        await new RegistrationFactory({ member, group: await new GroupFactory({ organization, period }).create() }).create();
        await new RegistrationFactory({ member, group: await new GroupFactory({ organization: otherOrganization, period }).create() }).create();

        const ownMembership = await createMembership({ memberId: member.id, organization });
        await createMembership({ memberId: member.id, organization: otherOrganization });

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);
        const headers = { authorization: 'Bearer ' + token.accessToken };

        // No organization filter: the frontend adds one, but the API must not rely on it
        const response = await testServer.test(endpoint, Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({ limit: 10 }),
            headers,
        }));

        expect(response.status).toBe(200);
        expect(response.body.results.map(m => m.id)).toEqual([ownMembership.id]);

        const countResponse = await testServer.test(countEndpoint, Request.get({
            path: baseUrl + '/count',
            host: organization.getApiHost(),
            query: new CountFilteredRequest({}),
            headers,
        }));

        expect(countResponse.status).toBe(200);
        expect(countResponse.body.count).toBe(1);
    });
});
