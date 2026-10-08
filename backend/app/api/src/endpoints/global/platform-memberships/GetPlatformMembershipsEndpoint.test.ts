import { Request } from '@simonbackx/simple-endpoints';
import type { Group, Organization, RegistrationPeriod } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, MemberPlatformMembership, OrganizationFactory, RegistrationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { AccessRight, CountFilteredRequest, LimitedFilteredRequest, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions, SortItemDirection } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
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

    /**
     * Creates a user whose role only grants read access to the passed group, plus the passed access rights.
     */
    async function createGroupLimitedUser({ organization, group, accessRights = [] }: { organization: Organization; group: Group; accessRights?: AccessRight[] }) {
        const role = PermissionRoleDetailed.create({
            name: 'Test Role',
            accessRights,
        });
        organization.privateMeta.roles.push(role);
        await organization.save();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                roles: [role],
                resources: new Map([[
                    PermissionsResourceType.Groups, new Map([[
                        group.id,
                        ResourcePermissions.create({
                            level: PermissionLevel.Read,
                            accessRights,
                        }),
                    ]]),
                ]]),
            }),
        }).create();

        const token = await SessionService.createSession(user);
        return { authorization: 'Bearer ' + token.accessToken };
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

    test('A user with access to one group only gets the memberships of the members of that group', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        const group = await new GroupFactory({ organization, period }).create();
        const otherGroup = await new GroupFactory({ organization, period }).create();

        const member = await new MemberFactory({}).create();
        await new RegistrationFactory({ member, group }).create();
        const otherMember = await new MemberFactory({}).create();
        await new RegistrationFactory({ member: otherMember, group: otherGroup }).create();

        const membership = await createMembership({ memberId: member.id, organization });
        await createMembership({ memberId: otherMember.id, organization });

        const headers = await createGroupLimitedUser({ organization, group });

        const response = await testServer.test(endpoint, Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({ limit: 10 }),
            headers,
        }));

        expect(response.status).toBe(200);
        expect(response.body.results.map(m => m.id)).toEqual([membership.id]);

        const countResponse = await testServer.test(countEndpoint, Request.get({
            path: baseUrl + '/count',
            host: organization.getApiHost(),
            query: new CountFilteredRequest({}),
            headers,
        }));

        expect(countResponse.status).toBe(200);
        expect(countResponse.body.count).toBe(1);
    });

    test('A user without permissions cannot list platform memberships', async () => {
        const organization = await new OrganizationFactory({ period }).create();
        const member = await new MemberFactory({}).create();
        await new RegistrationFactory({ member, group: await new GroupFactory({ organization, period }).create() }).create();
        await createMembership({ memberId: member.id, organization });

        const user = await new UserFactory({ organization }).create();
        const token = await SessionService.createSession(user);
        const headers = { authorization: 'Bearer ' + token.accessToken };

        await expect(testServer.test(endpoint, Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({ limit: 10 }),
            headers,
        }))).rejects.toThrow(STExpect.errorWithCode('permission_denied'));

        await expect(testServer.test(countEndpoint, Request.get({
            path: baseUrl + '/count',
            host: organization.getApiHost(),
            query: new CountFilteredRequest({}),
            headers,
        }))).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
    });

    describe('Financial data', () => {
        async function setup(accessRights: AccessRight[]) {
            const organization = await new OrganizationFactory({ period }).create();
            const group = await new GroupFactory({ organization, period }).create();
            const member = await new MemberFactory({}).create();
            await new RegistrationFactory({ member, group }).create();
            const membership = await createMembership({ memberId: member.id, organization });
            const headers = await createGroupLimitedUser({ organization, group, accessRights });
            return { organization, membership, headers };
        }

        test('A user with financial read access sees the price of a membership and can sort on it', async () => {
            const { organization, membership, headers } = await setup([AccessRight.MemberReadFinancialData]);

            const response = await testServer.test(endpoint, Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ limit: 10, sort: [{ key: 'price', order: SortItemDirection.ASC }] }),
                headers,
            }));

            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(1);
            expect(response.body.results[0]).toMatchObject({
                id: membership.id,
                price: 3000,
                priceWithoutDiscount: 4000,
            });
        });

        test('A user without financial read access does not see the price of a membership', async () => {
            const { organization, membership, headers } = await setup([]);

            const response = await testServer.test(endpoint, Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ limit: 10 }),
                headers,
            }));

            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(1);
            expect(response.body.results[0]).toMatchObject({
                id: membership.id,
                price: null,
                priceWithoutDiscount: null,
                balanceItem: null,
            });
        });

        test('A user without financial read access cannot sort or filter on the price of a membership', async () => {
            const { organization, headers } = await setup([]);

            await expect(testServer.test(endpoint, Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ limit: 10, sort: [{ key: 'price', order: SortItemDirection.ASC }] }),
                headers,
            }))).rejects.toThrow(STExpect.errorWithCode('permission_denied'));

            await expect(testServer.test(endpoint, Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ limit: 10, filter: { price: { $eq: 3000 } } }),
                headers,
            }))).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        });
    });
});
