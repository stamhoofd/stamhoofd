import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, OrganizationFactory, RegistrationInvitation, RegistrationInvitationFactory, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import type { PaginatedResponse, RegistrationInvitation as RegistrationInvitationStruct, StamhoofdFilter } from '@stamhoofd/structures';
import { LimitedFilteredRequest, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, TranslatedString } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetRegistrationInvitationsEndpoint } from './GetRegistrationInvitationsEndpoint.js';

describe('Endpoint.GetRegistrationInvitationsEndpoint', () => {
    const endpoint = new GetRegistrationInvitationsEndpoint();

    const getInvitations = async ({ filter, organization, user }: { filter: StamhoofdFilter; organization: Organization | null; user: User | null }) => {
        let authorization = '';

        if (user) {
            const token = await Token.createToken(user);
            authorization = 'Bearer ' + token.accessToken;
        }

        const request = Request.get({
            path: '/registration-invitations',
            host: organization?.getApiHost(),
            query: new LimitedFilteredRequest({
                filter,
                limit: 10,
            }),
            headers: {
                authorization,
            },
        });

        return testServer.test<PaginatedResponse<RegistrationInvitationStruct[], LimitedFilteredRequest>>(endpoint, request);
    };

    afterEach(async () => {
        await RegistrationInvitation.delete();
    });

    describe('Permission checking', () => {
        describe('read access for specific group', () => {
            test('should only return invitations for that group', async () => {
                const organization = await new OrganizationFactory({}).create();
                const groupName = 'test groep';
                const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
                const group2 = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();

                const resources = new Map();

                resources.set(
                    PermissionsResourceType.Groups, new Map([[
                        group.id,
                        ResourcePermissions.create({
                            level: PermissionLevel.Write,
                        }),
                    ]]),
                );

                const user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({
                        level: PermissionLevel.None,
                        resources,
                    }),
                }).create();

                const member = await new MemberFactory({
                    organization, user,
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: { year: 1994, month: 6, day: 24 },
                }).create();

                const member2 = await new MemberFactory({
                    organization, user,
                    firstName: 'Test1',
                    lastName: 'Test1',
                    birthDay: { year: 1998, month: 3, day: 1 },
                }).create();

                // invitations for group
                await new RegistrationInvitationFactory({ group, member, organization }).create();
                await new RegistrationInvitationFactory({ group, member: member2, organization }).create();

                // invitations for other group
                const invitationForOtherGroup = await new RegistrationInvitationFactory({ group: group2, member, organization }).create();

                const response = await getInvitations({
                    filter: null,
                    organization,
                    user,
                });

                // assert
                expect(response.status).toBe(200);
                expect(response.body.results).toHaveLength(2);
                expect(response.body.results.map(r => r.id)).not.toContain(invitationForOtherGroup.id);
            });

            test('cannot read invitations for other group', async () => {
                const organization = await new OrganizationFactory({}).create();
                const groupName = 'test groep';
                const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
                const group2 = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();

                const resources = new Map();

                resources.set(
                    PermissionsResourceType.Groups, new Map([[
                        group.id,
                        ResourcePermissions.create({
                            level: PermissionLevel.Write,
                        }),
                    ]]),
                );

                const user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({
                        level: PermissionLevel.None,
                        resources,
                    }),
                }).create();

                const member = await new MemberFactory({
                    organization, user,
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: { year: 1994, month: 6, day: 24 },
                }).create();

                const member2 = await new MemberFactory({
                    organization, user,
                    firstName: 'Test1',
                    lastName: 'Test1',
                    birthDay: { year: 1998, month: 3, day: 1 },
                }).create();

                // invitations for group
                await new RegistrationInvitationFactory({ group, member, organization }).create();
                await new RegistrationInvitationFactory({ group, member: member2, organization }).create();

                // invitations for other group
                await new RegistrationInvitationFactory({ group: group2, member, organization }).create();

                // assert
                await expect(getInvitations({
                    filter: {
                        groupId: group2.id,
                    },
                    organization,
                    user,
                })).rejects.toThrow('You do not have access to this group');
            });
        });

        describe('read access for specific organization', () => {
            test('can read invitations for any group of organization', async () => {
                const organization = await new OrganizationFactory({}).create();
                const groupName = 'test groep';
                const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
                const group2 = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();

                const user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({ level: PermissionLevel.Read }),
                }).create();

                const member = await new MemberFactory({
                    organization, user,
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: { year: 1994, month: 6, day: 24 },
                }).create();

                const member2 = await new MemberFactory({
                    organization, user,
                    firstName: 'Test1',
                    lastName: 'Test1',
                    birthDay: { year: 1998, month: 3, day: 1 },
                }).create();

                const organization2 = await new OrganizationFactory({}).create();
                const groupOfOtherOrganization = await new GroupFactory({ organization: organization2 }).create();

                // invitations for group
                await new RegistrationInvitationFactory({ group, member, organization }).create();
                await new RegistrationInvitationFactory({ group, member: member2, organization }).create();

                // invitations for other group
                await new RegistrationInvitationFactory({ group: group2, member, organization }).create();

                // invitations for other organization
                const invitationForOtherOrganization = await new RegistrationInvitationFactory({
                    group: groupOfOtherOrganization,
                    member,
                    organization: organization2,
                }).create();

                const response = await getInvitations({
                    filter: null,
                    organization,
                    user,
                });

                // assert
                expect(response.status).toBe(200);
                // should only include registrations for organization of user
                expect(response.body.results).toHaveLength(3);
                expect(response.body.results.map(r => r.id)).not.toContain(invitationForOtherOrganization.id);
            });

            test('cannot read invitations for other organization', async () => {
                const organization = await new OrganizationFactory({}).create();
                const groupName = 'test groep';
                const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
                const group2 = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();

                const user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({ level: PermissionLevel.Read }),
                }).create();

                const member = await new MemberFactory({
                    organization, user,
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: { year: 1994, month: 6, day: 24 },
                }).create();

                const member2 = await new MemberFactory({
                    organization, user,
                    firstName: 'Test1',
                    lastName: 'Test1',
                    birthDay: { year: 1998, month: 3, day: 1 },
                }).create();

                const organization2 = await new OrganizationFactory({}).create();
                const groupOfOtherOrganization = await new GroupFactory({ organization: organization2 }).create();

                // invitations for group
                await new RegistrationInvitationFactory({ group, member, organization }).create();
                await new RegistrationInvitationFactory({ group, member: member2, organization }).create();

                // invitations for other group
                await new RegistrationInvitationFactory({ group: group2, member, organization }).create();

                // invitations for other organization
                await new RegistrationInvitationFactory({
                    group: groupOfOtherOrganization,
                    member,
                    organization: organization2,
                }).create();

                const response = await getInvitations({
                    filter: {
                        organizationId: organization2.id,
                    },
                    organization,
                    user,
                });

                // assert
                expect(response.status).toBe(200);
                expect(response.body.results).toHaveLength(0);
            });
        });

        describe('platform permissions', () => {
            beforeEach(async () => {
                TestUtils.setEnvironment('userMode', 'platform');
            });

            test('can read all invitations for read access for platform', async () => {
                const organization = await new OrganizationFactory({}).create();
                const groupName = 'test groep';
                const group = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();
                const group2 = await new GroupFactory({ organization, name: new TranslatedString(groupName) }).create();

                const user = await new UserFactory({
                    globalPermissions: Permissions.create({ level: PermissionLevel.Read }),
                }).create();

                const member = await new MemberFactory({
                    organization, user,
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: { year: 1994, month: 6, day: 24 },
                }).create();

                const member2 = await new MemberFactory({
                    organization, user,
                    firstName: 'Test1',
                    lastName: 'Test1',
                    birthDay: { year: 1998, month: 3, day: 1 },
                }).create();

                const organization2 = await new OrganizationFactory({}).create();
                const groupOfOtherOrganization = await new GroupFactory({ organization: organization2 }).create();

                // invitations for group
                await new RegistrationInvitationFactory({ group, member, organization }).create();
                await new RegistrationInvitationFactory({ group, member: member2, organization }).create();

                // invitations for other group
                await new RegistrationInvitationFactory({ group: group2, member, organization }).create();

                // invitations for other organization
                const invitationForOtherOrganization = await new RegistrationInvitationFactory({
                    group: groupOfOtherOrganization,
                    member,
                    organization: organization2,
                }).create();

                const response = await getInvitations({
                    filter: null,
                    organization,
                    user,
                });

                // assert
                expect(response.status).toBe(200);
                // should only include registrations for organization of user
                expect(response.body.results).toHaveLength(4);
                expect(response.body.results.map(r => r.id)).toContain(invitationForOtherOrganization.id);
            });

            test('can only read invitations for group with tag if only access to groups with tags', async () => {
                const organization1 = await new OrganizationFactory({}).create();
                const period = await new RegistrationPeriodFactory({
                    organization: organization1,
                    startDate: new Date(2023, 0, 1),
                    endDate: new Date(2023, 11, 31),
                }).create();

                organization1.periodId = period.id;
                await organization1.save();

                const groupName = 'test groep';
                const group = await new GroupFactory({ organization: organization1, name: new TranslatedString(groupName), period }).create();
                const group2 = await new GroupFactory({ organization: organization1, name: new TranslatedString(groupName), period }).create();

                const resources = new Map();

                const tag = 'tagtest';

                resources.set(
                    PermissionsResourceType.OrganizationTags, new Map([[
                        tag,
                        ResourcePermissions.create({
                            level: PermissionLevel.Full,
                            accessRights: [],
                        }),
                    ]]),
                );

                const user = await new UserFactory({
                    globalPermissions: Permissions.create({
                        level: PermissionLevel.None,
                        roles: [],
                        resources,
                    }),
                }).create();

                const member = await new MemberFactory({
                    organization: organization1, user,
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: { year: 1994, month: 6, day: 24 },
                }).create();

                const member2 = await new MemberFactory({
                    organization: organization1, user,
                    firstName: 'Test1',
                    lastName: 'Test1',
                    birthDay: { year: 1998, month: 3, day: 1 },
                }).create();

                const organization2 = await new OrganizationFactory({ tags: [tag], period }).create();
                const groupOfOtherOrganization = await new GroupFactory({ organization: organization2, period }).create();

                // invitations for group
                await new RegistrationInvitationFactory({ group, member, organization: organization1 }).create();
                await new RegistrationInvitationFactory({ group, member: member2, organization: organization1 }).create();

                // invitations for other group
                await new RegistrationInvitationFactory({ group: group2, member, organization: organization1 }).create();

                // invitations for other organization
                const invitationForOtherOrganization = await new RegistrationInvitationFactory({
                    group: groupOfOtherOrganization,
                    member,
                    organization: organization2,
                }).create();

                const response = await getInvitations({
                    filter: null,
                    // organization scope is required
                    organization: organization2,
                    user,
                });

                // assert
                expect(response.status).toBe(200);
                // should only include registrations for organization of user
                expect(response.body.results).toHaveLength(1);
                expect(response.body.results.map(r => r.id)).toContain(invitationForOtherOrganization.id);

                // should not have access to all invitations of organization1
                await expect(getInvitations({
                    filter: null,
                    // organization scope is required
                    organization: organization1,
                    user,
                })).rejects.toThrow('You must filter on a group of the organization you are trying to access');
            });

            test('cannot get invitations if platform scope and no access to all organization tags', async () => {
                const organization = await new OrganizationFactory({}).create();
                const period = await new RegistrationPeriodFactory({
                    organization,
                    startDate: new Date(2023, 0, 1),
                    endDate: new Date(2023, 11, 31),
                }).create();

                organization.periodId = period.id;
                await organization.save();

                const groupName = 'test groep';
                const group = await new GroupFactory({ organization, name: new TranslatedString(groupName), period }).create();
                const group2 = await new GroupFactory({ organization, name: new TranslatedString(groupName), period }).create();

                const resources = new Map();

                const tag = 'tagtest';

                resources.set(
                    PermissionsResourceType.OrganizationTags, new Map([[
                        tag,
                        ResourcePermissions.create({
                            level: PermissionLevel.Full,
                            accessRights: [],
                        }),
                    ]]),
                );

                const user = await new UserFactory({
                    globalPermissions: Permissions.create({
                        level: PermissionLevel.None,
                        roles: [],
                        resources,
                    }),
                }).create();

                const member = await new MemberFactory({
                    organization, user,
                    firstName: 'John',
                    lastName: 'Doe',
                    birthDay: { year: 1994, month: 6, day: 24 },
                }).create();

                const member2 = await new MemberFactory({
                    organization, user,
                    firstName: 'Test1',
                    lastName: 'Test1',
                    birthDay: { year: 1998, month: 3, day: 1 },
                }).create();

                const organization2 = await new OrganizationFactory({ tags: [tag], period }).create();
                const groupOfOtherOrganization = await new GroupFactory({ organization: organization2, period }).create();

                // invitations for group
                await new RegistrationInvitationFactory({ group, member, organization }).create();
                await new RegistrationInvitationFactory({ group, member: member2, organization }).create();

                // invitations for other group
                await new RegistrationInvitationFactory({ group: group2, member, organization }).create();

                // invitations for other organization
                await new RegistrationInvitationFactory({
                    group: groupOfOtherOrganization,
                    member,
                    organization: organization2,
                }).create();

                await expect(getInvitations({
                    filter: null,
                    organization: null,
                    user,
                })).rejects.toThrow('You do not have permissions for this action');
            });
        });
    });
});
