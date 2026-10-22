import { Request } from '@simonbackx/simple-endpoints';
import type { Group, Member, Organization, User } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, OrganizationFactory, RegistrationInvitation, RegistrationInvitationFactory, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import type { PaginatedResponse, RegistrationInvitation as RegistrationInvitationStruct, StamhoofdFilter } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { PermissionsResourceType } from '@stamhoofd/types/PermissionsResourceType';
import { CountFilteredRequest, LimitedFilteredRequest, Permissions, ResourcePermissions, TranslatedString } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetRegistrationInvitationsCountEndpoint } from './GetRegistrationInvitationsCountEndpoint.js';
import { GetRegistrationInvitationsEndpoint } from './GetRegistrationInvitationsEndpoint.js';
import { SessionService } from '../../../services/SessionService.js';

describe('Endpoint.GetRegistrationInvitationsEndpoint', () => {
    const endpoint = new GetRegistrationInvitationsEndpoint();

    const getInvitations = async ({ filter, organization, user }: { filter: StamhoofdFilter; organization: Organization | null; user: User | null }) => {
        let authorization = '';

        if (user) {
            const token = await SessionService.createSession(user);
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

    describe('Handcrafted filters', () => {
        // The invitation groupId filter has no permission check of its own, so the scope filter and
        // validateGroupFilter are the only things keeping invitations of other groups out of the result.
        // Fixtures are recreated per test because the suite deletes all invitations after each test.
        let organization: Organization;
        let allowedGroup: Group;
        let forbiddenGroup: Group;
        let member: Member;
        let headers: { authorization: string };
        let allowedInvitation: RegistrationInvitation;
        let otherAllowedInvitation: RegistrationInvitation;

        beforeEach(async () => {
            organization = await new OrganizationFactory({}).create();
            allowedGroup = await new GroupFactory({ organization }).create();
            forbiddenGroup = await new GroupFactory({ organization }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.Groups,
                        new Map([[allowedGroup.id, ResourcePermissions.create({ level: PermissionLevel.Write })]]),
                    ]]),
                }),
            }).create();
            const token = await SessionService.createSession(user);
            headers = { authorization: 'Bearer ' + token.accessToken };

            member = await new MemberFactory({ organization, user, firstName: 'John', lastName: 'Doe', birthDay: { year: 1994, month: 6, day: 24 } }).create();
            const member2 = await new MemberFactory({ organization, user, firstName: 'Jane', lastName: 'Doe', birthDay: { year: 1998, month: 3, day: 1 } }).create();

            allowedInvitation = await new RegistrationInvitationFactory({ group: allowedGroup, member, organization }).create();
            otherAllowedInvitation = await new RegistrationInvitationFactory({ group: allowedGroup, member: member2, organization }).create();
            await new RegistrationInvitationFactory({ group: forbiddenGroup, member, organization }).create();
        });

        const fetchIds = async (filter: StamhoofdFilter) => {
            const response = await testServer.test(endpoint, Request.get({
                path: '/registration-invitations',
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ filter, limit: 10 }),
                headers,
            }));
            expect(response.status).toBe(200);
            return response.body.results.map(r => r.id);
        };

        const count = async (filter: StamhoofdFilter) => {
            const response = await testServer.test(new GetRegistrationInvitationsCountEndpoint(), Request.get({
                path: '/registration-invitations/count',
                host: organization.getApiHost(),
                query: new CountFilteredRequest({ filter }),
                headers,
            }));
            return response.body.count;
        };

        const expectDenied = async (filter: StamhoofdFilter) => {
            await expect(fetchIds(filter)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
            await expect(count(filter)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        };

        const expectVisible = async (filter: StamhoofdFilter, invitationIds: string[]) => {
            expect(await fetchIds(filter)).toIncludeSameMembers(invitationIds);
            expect(await count(filter)).toBe(invitationIds.length);
        };

        test('A group filter wrapped in a top-level array or $and returns the same invitations as the plain object', async () => {
            const expected = [allowedInvitation.id, otherAllowedInvitation.id];
            await expectVisible({ groupId: allowedGroup.id }, expected);
            await expectVisible([{ groupId: allowedGroup.id }], expected);
            await expectVisible({ $and: [{ groupId: allowedGroup.id }] }, expected);
            await expectVisible({ $and: [[{ groupId: allowedGroup.id }]] }, expected);
            await expectVisible([{ $and: [{ groupId: allowedGroup.id }] }, { memberId: member.id }], [allowedInvitation.id]);
            await expectVisible([{ groupId: { $: '$rel', value: allowedGroup.id, name: 'Allowed' } }], expected);
        });

        test('A group filter inside an $or does not lift the scope filter', async () => {
            const expected = [allowedInvitation.id, otherAllowedInvitation.id];
            await expectVisible({ $or: [{ groupId: allowedGroup.id }, { groupId: forbiddenGroup.id }] }, expected);
            await expectVisible([{ $or: [{ groupId: allowedGroup.id }, { groupId: forbiddenGroup.id }] }], expected);
            await expectVisible({ $and: [{ $or: [{ groupId: allowedGroup.id }, { groupId: forbiddenGroup.id }] }] }, expected);
            await expectVisible({ $and: [[{ $or: [{ groupId: allowedGroup.id }, { memberId: member.id }] }]] }, expected);
            await expectVisible({ $or: [{ $and: [{ groupId: allowedGroup.id }] }, { groupId: forbiddenGroup.id }] }, expected);
            await expectVisible([{ memberId: member.id }], [allowedInvitation.id]);
        });

        test('A negated group filter does not lift the scope filter', async () => {
            await expectVisible({ $not: { groupId: allowedGroup.id } }, []);
            await expectVisible([{ $not: { groupId: allowedGroup.id } }], []);
            await expectVisible({ $and: [{ $not: { groupId: allowedGroup.id } }] }, []);
        });

        test('An $and that is an object instead of an array does not lift the scope filter', async () => {
            await expectVisible({ $and: { groupId: forbiddenGroup.id } }, []);
        });

        test('Extra conditions next to the group filter can only narrow the result', async () => {
            await expectVisible([{ groupId: allowedGroup.id }, { groupId: forbiddenGroup.id }], []);
            await expectVisible({ $and: [{ groupId: allowedGroup.id }, { groupId: forbiddenGroup.id }] }, []);
            await expectVisible({ groupId: allowedGroup.id, $or: [{ groupId: forbiddenGroup.id }, { memberId: member.id }] }, [allowedInvitation.id]);
            await expectVisible({ $and: [{ groupId: allowedGroup.id }], $or: [{ groupId: forbiddenGroup.id }, { memberId: member.id }] }, [allowedInvitation.id]);
            await expectVisible([{ groupId: allowedGroup.id }, { $or: [{ groupId: forbiddenGroup.id }, { memberId: member.id }] }], [allowedInvitation.id]);
            await expectVisible([{ groupId: allowedGroup.id }, { groupId: { $neq: allowedGroup.id } }], []);
            await expectVisible([{ groupId: { $in: [allowedGroup.id], $neq: allowedGroup.id } }], []);
            await expectVisible([{ groupId: { $in: [allowedGroup.id], $or: [{ $eq: forbiddenGroup.id }] } }], []);
        });

        test('A forbidden group in the required position is rejected', async () => {
            await expectDenied([{ groupId: forbiddenGroup.id }]);
            await expectDenied([{ groupId: { $in: [allowedGroup.id, forbiddenGroup.id] } }]);
            await expectDenied({ $and: [[{ groupId: { $in: [forbiddenGroup.id, allowedGroup.id] } }]] });
            await expectDenied([{ groupId: { $: '$rel', value: forbiddenGroup.id, name: 'Forbidden' } }]);
            await expectDenied([{ groupId: { $in: [{ $: '$rel', value: forbiddenGroup.id, name: 'Forbidden' }] } }]);
        });

        test('A user without any group access cannot use a wrapped filter to see invitations', async () => {
            const noAccessUser = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.None }),
            }).create();

            const filters: StamhoofdFilter[] = [
                [{ groupId: allowedGroup.id }],
                { $or: [{ groupId: allowedGroup.id }] },
                { $not: { groupId: allowedGroup.id } },
                [{ memberId: member.id }],
            ];
            for (const filter of filters) {
                await expect(getInvitations({ filter, organization, user: noAccessUser })).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
            }
        });
    });
});
