import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, RegistrationPeriod } from '@stamhoofd/models';
import { MemberFactory, MemberPlatformMembership, OrganizationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { LimitedFilteredRequest, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { GetPlatformMembershipsEndpoint } from './GetPlatformMembershipsEndpoint.js';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';

const baseUrl = '/platform-memberships';
const platformHost = 'platform.stamhoofd.app';
const endpoint = new GetPlatformMembershipsEndpoint();

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
});
