import type { Endpoint } from '@simonbackx/simple-endpoints';
import { Request } from '@simonbackx/simple-endpoints';
import type { MemberWithUsersRegistrationsAndGroups, Organization, RegistrationPeriod, Token } from '@stamhoofd/models';
import { BalanceItemFactory, CachedBalance, EventFactory, GroupFactory, MemberFactory, MemberPlatformMembership, OrganizationFactory, RecordCategoryFactory, RegistrationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import type { SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { AccessRight, BalanceItemStatus, BalanceItemType, EventMeta, GroupStatus, GroupType, LimitedFilteredRequest, NamedObject, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceKey, PermissionsResourceType, RecordAnswer, RecordDateAnswer, RecordTextAnswer, RecordType, ResourcePermissions, SortItemDirection } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { Language } from '@stamhoofd/types/Language';
import { GetMembersEndpoint } from './GetMembersEndpoint.js';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initPlatformRecordCategory } from '../../../../tests/init/initPlatformRecordCategory.js';
import { SessionService } from '../../../services/SessionService.js';

const baseUrl = `/members`;
const endpoint = new GetMembersEndpoint();
type EndpointType = typeof endpoint;
type Body = EndpointType extends Endpoint<any, any, infer B, any> ? B : never;

describe('Endpoint.GetMembersEndpoint', () => {
    let period: RegistrationPeriod;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();
    });

    describe('Permission checking', () => {
        test('Allowed: Can fetch members for a given group', async () => {
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();
            const group = await new GroupFactory({ organization, period }).create();

            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(2);

            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
                expect.objectContaining({ id: member2.id }),
            ]);
        });

        test('Not allowed: Cannot fetch members for a given group', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();
            const group = await new GroupFactory({ organization, period }).create();
            const group2 = await new GroupFactory({ organization, period }).create();

            // Give permission to a different group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group2.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('Allowed: Can fetch members for multiple groups at the same time', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();
            const group = await new GroupFactory({ organization, period }).create();
            const group2 = await new GroupFactory({ organization, period }).create();

            // Give permission to a different group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ], [
                    group2.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group: group2 }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: {
                                    $in: [group.id, group2.id],
                                },
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(2);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
                expect.objectContaining({ id: member2.id }),
            ]);
        });

        test('Not allowed: Cannot fetch members for multiple groups at the same time if no permissions for one of them', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();
            const group = await new GroupFactory({ organization, period }).create();
            const group2 = await new GroupFactory({ organization, period }).create();

            // Only give permissions for one group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group: group2 }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: {
                                    $in: [group.id, group2.id],
                                },
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('Allowed: Can fetch all members if permissions for at least one group', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();
            const member3 = await new MemberFactory({ }).create();
            const group = await new GroupFactory({ organization, period }).create();
            const group2 = await new GroupFactory({ organization, period }).create();
            const group3 = await new GroupFactory({ organization, period }).create();

            // Give permission for 2 / 3 groups
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ], [
                    group2.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group: group2 }).create();
            await new RegistrationFactory({ member: member3, group: group3 }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(2);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
                expect.objectContaining({ id: member2.id }),
            ]);
        });

        test('User can fetch members of previous period if has group access', async () => {
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const previousPeriod = await new RegistrationPeriodFactory({
                startDate: new Date(2022, 0, 1),
                endDate: new Date(2022, 11, 31),
            }).create();

            // The organization already moved on to period
            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();
            const previousPeriodGroup = await new GroupFactory({ organization, period: previousPeriod }).create();
            const otherPreviousPeriodGroup = await new GroupFactory({ organization, period: previousPeriod }).create();

            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    previousPeriodGroup.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group: previousPeriodGroup }).create();
            await new RegistrationFactory({ member: member2, group: otherPreviousPeriodGroup }).create();

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
            ]);
        });

        describe('Period scoping', () => {
            /**
             * One organization on `period` with a group in the current period and two in a
             * previous one, each holding a single member.
             */
            async function setupPeriods() {
                const previousPeriod = await new RegistrationPeriodFactory({
                    startDate: new Date(2022, 0, 1),
                    endDate: new Date(2022, 11, 31),
                }).create();

                const organization = await new OrganizationFactory({ period }).create();

                const currentGroup = await new GroupFactory({ organization, period }).create();
                const previousGroup = await new GroupFactory({ organization, period: previousPeriod }).create();
                const otherPreviousGroup = await new GroupFactory({ organization, period: previousPeriod }).create();

                const currentMember = await new MemberFactory({}).create();
                const previousMember = await new MemberFactory({}).create();
                const otherPreviousMember = await new MemberFactory({}).create();

                await new RegistrationFactory({ member: currentMember, group: currentGroup }).create();
                await new RegistrationFactory({ member: previousMember, group: previousGroup }).create();
                await new RegistrationFactory({ member: otherPreviousMember, group: otherPreviousGroup }).create();

                return { organization, currentGroup, previousGroup, currentMember, previousMember, otherPreviousMember };
            }

            async function fetchMembers(organization: Awaited<ReturnType<typeof setupPeriods>>['organization'], groupPermissions: [string, ResourcePermissions][], level: PermissionLevel = PermissionLevel.None) {
                const user = await new UserFactory({
                    organization,
                    permissions: Permissions.create({
                        level,
                        resources: new Map([[PermissionsResourceType.Groups, new Map(groupPermissions)]]),
                    }),
                }).create();

                const token = await SessionService.createSession(user);

                return await testServer.test(endpoint, Request.get({
                    path: baseUrl,
                    host: organization.getApiHost(),
                    query: new LimitedFilteredRequest({ limit: 100 }),
                    headers: { authorization: 'Bearer ' + token.accessToken },
                }));
            }

            const read = () => ResourcePermissions.create({ level: PermissionLevel.Read });

            test('A $currentPeriod grant does not reach previous periods', async () => {
                const { organization, currentMember } = await setupPeriods();

                const response = await fetchMembers(organization, [
                    [PermissionsResourceKey.CurrentPeriod, read()],
                ]);

                expect(response.status).toBe(200);
                expect(response.body.results.members).toIncludeSameMembers([
                    expect.objectContaining({ id: currentMember.id }),
                ]);
            });

            test('An explicit grant on a previous period group is not lost by adding $currentPeriod', async () => {
                const { organization, previousGroup, currentMember, previousMember } = await setupPeriods();

                const response = await fetchMembers(organization, [
                    [PermissionsResourceKey.CurrentPeriod, read()],
                    [previousGroup.id, read()],
                ]);

                expect(response.status).toBe(200);
                expect(response.body.results.members).toIncludeSameMembers([
                    expect.objectContaining({ id: currentMember.id }),
                    expect.objectContaining({ id: previousMember.id }),
                ]);
            });

            test('An $all grant does not reach archived groups', async () => {
                const { organization, currentGroup, previousMember, otherPreviousMember } = await setupPeriods();

                currentGroup.status = GroupStatus.Archived;
                await currentGroup.save();

                const response = await fetchMembers(organization, [
                    [PermissionsResourceKey.All, read()],
                ]);

                expect(response.status).toBe(200);
                expect(response.body.results.members).toIncludeSameMembers([
                    expect.objectContaining({ id: previousMember.id }),
                    expect.objectContaining({ id: otherPreviousMember.id }),
                ]);
            });

            test('A $currentPeriod grant does not reach an archived group of the current period', async () => {
                const { organization, currentGroup, previousGroup, currentMember, previousMember } = await setupPeriods();

                currentGroup.status = GroupStatus.Archived;
                await currentGroup.save();

                // The explicit grant keeps the enumeration branch running alongside the period filter.
                const response = await fetchMembers(organization, [
                    [PermissionsResourceKey.CurrentPeriod, read()],
                    [previousGroup.id, read()],
                ]);

                expect(response.status).toBe(200);
                expect(response.body.results.members).toIncludeSameMembers([
                    expect.objectContaining({ id: previousMember.id }),
                ]);
                expect(response.body.results.members).not.toContainEqual(
                    expect.objectContaining({ id: currentMember.id }),
                );
            });

            test('Full access still reaches archived groups', async () => {
                const { organization, currentGroup, currentMember, previousMember, otherPreviousMember } = await setupPeriods();

                currentGroup.status = GroupStatus.Archived;
                await currentGroup.save();

                const response = await fetchMembers(organization, [], PermissionLevel.Full);

                expect(response.status).toBe(200);
                expect(response.body.results.members).toIncludeSameMembers([
                    expect.objectContaining({ id: currentMember.id }),
                    expect.objectContaining({ id: previousMember.id }),
                    expect.objectContaining({ id: otherPreviousMember.id }),
                ]);
            });

            test('An $all grant reaches every period', async () => {
                const { organization, currentMember, previousMember, otherPreviousMember } = await setupPeriods();

                const response = await fetchMembers(organization, [
                    [PermissionsResourceKey.All, read()],
                ]);

                expect(response.status).toBe(200);
                expect(response.body.results.members).toIncludeSameMembers([
                    expect.objectContaining({ id: currentMember.id }),
                    expect.objectContaining({ id: previousMember.id }),
                    expect.objectContaining({ id: otherPreviousMember.id }),
                ]);
            });
        });

        test('Not allowed: Cannot combine an allowed group with a forbidden one in a conjunction', async () => {
            const organization = await new OrganizationFactory({ period }).create();

            const allowedGroup = await new GroupFactory({ organization, period }).create();
            const forbiddenGroup = await new GroupFactory({ organization, period }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.Groups,
                        new Map([[allowedGroup.id, ResourcePermissions.create({ level: PermissionLevel.Read })]]),
                    ]]),
                }),
            }).create();

            const token = await SessionService.createSession(user);

            // This member is in both groups: an $elemMatch on each does not narrow to one group,
            // so combining them would reveal who of the allowed group is also in the other one
            const memberInBoth = await new MemberFactory({}).create();
            await new RegistrationFactory({ member: memberInBoth, group: allowedGroup }).create();
            await new RegistrationFactory({ member: memberInBoth, group: forbiddenGroup }).create();

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        $and: [
                            { registrations: { $elemMatch: { groupId: allowedGroup.id } } },
                            { registrations: { $elemMatch: { groupId: forbiddenGroup.id } } },
                        ],
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('Not allowed: Cannot fetch all members if no permissions for a single group', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [AccessRight.WebshopScanTickets],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();
            const member3 = await new MemberFactory({ }).create();
            const group = await new GroupFactory({ organization, period }).create();
            const group2 = await new GroupFactory({ organization, period }).create();
            const group3 = await new GroupFactory({ organization, period }).create();

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group: group2 }).create();
            await new RegistrationFactory({ member: member3, group: group3 }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('Allowed: A user inherits permissions for an event', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();

            const defaultGroup = await new GroupFactory({ organization, period }).create();
            const group = await new GroupFactory({ organization, period, type: GroupType.EventRegistration }).create();
            const event = await new EventFactory({
                organization,
                group,
                startDate: period.startDate,
                endDate: period.endDate,
                meta: EventMeta.create({
                    groups: [
                        NamedObject.create({
                            id: defaultGroup.id,
                            name: defaultGroup.settings.name.toString(),
                        }),
                    ],
                }),
            }).create();

            // Give the user write permissions to all events targeted to the default group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    defaultGroup.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.None,
                        accessRights: [AccessRight.EventWrite],
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(2);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
                expect.objectContaining({ id: member2.id }),
            ]);
        });

        test('Allowed: A user inherits permissions for the waiting list of an event', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();
            const member3 = await new MemberFactory({ }).create();

            const defaultGroup = await new GroupFactory({ organization, period }).create();
            const waitingList = await new GroupFactory({ organization, period, type: GroupType.WaitingList }).create();
            const group = await new GroupFactory({ organization, period, type: GroupType.EventRegistration, waitingListId: waitingList.id }).create();

            const event = await new EventFactory({
                organization,
                group,
                startDate: period.startDate,
                endDate: period.endDate,
                meta: EventMeta.create({
                    groups: [
                        NamedObject.create({
                            id: defaultGroup.id,
                            name: defaultGroup.settings.name.toString(),
                        }),
                    ],
                }),
            }).create();

            // Give the user write permissions to all events targeted to the default group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    defaultGroup.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.None,
                        accessRights: [AccessRight.EventWrite],
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group: waitingList }).create();
            await new RegistrationFactory({ member: member2, group: waitingList }).create();
            await new RegistrationFactory({ member: member3, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: waitingList.id,
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(2);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
                expect.objectContaining({ id: member2.id }),
            ]);
        });

        test('Not allowed: A user cannot request registrations of an event if no permission to events', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();

            const defaultGroup = await new GroupFactory({ organization, period }).create();
            const group = await new GroupFactory({ organization, period, type: GroupType.EventRegistration }).create();
            const event = await new EventFactory({
                organization,
                group,
                startDate: period.startDate,
                endDate: period.endDate,
                meta: EventMeta.create({
                    groups: [
                        NamedObject.create({
                            id: defaultGroup.id,
                            name: defaultGroup.settings.name.toString(),
                        }),
                    ],
                }),
            }).create();

            // The user can read members registered for default group, but not events for default group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    defaultGroup.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                        accessRights: [],
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('Not allowed: A user cannot request registrations of an event for all members if only access to events for a single group', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();

            const defaultGroup = await new GroupFactory({ organization, period }).create();
            const group = await new GroupFactory({ organization, period, type: GroupType.EventRegistration }).create();

            // Event for all members of the organization (so no permission to this event)
            const event = await new EventFactory({
                organization,
                group,
                startDate: period.startDate,
                endDate: period.endDate,
            }).create();

            // The user can read members registered for default group, but not events for default group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    defaultGroup.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                        accessRights: [AccessRight.EventWrite],
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('Not allowed: A user cannot request registrations for the waiting list of an event if no permissions for event', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();
            const member3 = await new MemberFactory({ }).create();

            const defaultGroup = await new GroupFactory({ organization, period }).create();
            const waitingList = await new GroupFactory({ organization, period, type: GroupType.WaitingList }).create();
            const group = await new GroupFactory({ organization, period, type: GroupType.EventRegistration, waitingListId: waitingList.id }).create();

            const event = await new EventFactory({
                organization,
                group,
                startDate: period.startDate,
                endDate: period.endDate,
                meta: EventMeta.create({
                    groups: [
                        NamedObject.create({
                            id: defaultGroup.id,
                            name: defaultGroup.settings.name.toString(),
                        }),
                    ],
                }),
            }).create();

            // The user can read members registered for default group, but not events for default group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    defaultGroup.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                        accessRights: [],
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group: waitingList }).create();
            await new RegistrationFactory({ member: member2, group: waitingList }).create();
            await new RegistrationFactory({ member: member3, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: waitingList.id,
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('Not allowed: A user cannot filter on record answer if no permission for that category', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const recordCategory = await new RecordCategoryFactory({
                records: [
                    {
                        type: RecordType.Text,
                    },
                ],
            }).create();

            await initPlatformRecordCategory({ recordCategory });
            const record = recordCategory.records[0];

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();

            // Make sure member1 has answered the question
            const answer = RecordTextAnswer.create({ settings: record });
            answer.value = 'This has been answered';
            member1.details.recordAnswers.set(record.id, answer);
            await member1.save();

            const group = await new GroupFactory({ organization, period }).create();

            // The user can read members registered for default group, but not events for default group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                        accessRights: [],
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                        details: {
                            recordAnswers: {
                                [record.id]: {
                                    value: {
                                        $contains: 'has been',
                                    },
                                },
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('Allowed: A user can filter on record answer if permission for that category', async () => {
            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [] })
                .create();

            const recordCategory = await new RecordCategoryFactory({
                records: [
                    {
                        type: RecordType.Text,
                    },
                ],
            }).create();

            await initPlatformRecordCategory({ recordCategory });
            const record = recordCategory.records[0];

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();

            // Make sure member1 has answered the question
            const answer = RecordTextAnswer.create({ settings: record });
            answer.value = 'This has been answered';
            member1.details.recordAnswers.set(record.id, answer);
            await member1.save();

            const group = await new GroupFactory({ organization, period }).create();

            // The user can read members registered for default group, but not events for default group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                        accessRights: [],
                    }),
                ]]),
            );

            resources.set(
                PermissionsResourceType.RecordCategories, new Map([[
                    recordCategory.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                        accessRights: [],
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                        details: {
                            recordAnswers: {
                                [record.id]: {
                                    value: {
                                        $contains: 'has been',
                                    },
                                },
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            // Response only includes members registered in a membership group, not the event group
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(1);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
            ]);
        });

        test('Allowed: A platform admin can filter on record answer if permission for all members', async () => {
            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [] })
                .create();

            const recordCategory = await new RecordCategoryFactory({
                records: [
                    {
                        type: RecordType.Text,
                    },
                ],
            }).create();

            await initPlatformRecordCategory({ recordCategory });
            const record = recordCategory.records[0];

            const user = await new UserFactory({
                globalPermissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();

            // Make sure member1 has answered the question
            const answer = RecordTextAnswer.create({ settings: record });
            answer.value = 'This has been answered';
            member1.details.recordAnswers.set(record.id, answer);
            await member1.save();

            const group = await new GroupFactory({ organization, period }).create();

            resources.set(
                PermissionsResourceType.OrganizationTags, new Map([[
                    PermissionsResourceKey.All,
                    ResourcePermissions.create({
                        level: PermissionLevel.Full,
                        accessRights: [],
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                        details: {
                            recordAnswers: {
                                [record.id]: {
                                    value: {
                                        $contains: 'has been',
                                    },
                                },
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            // Response only includes members registered in a membership group, not the event group
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(1);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
            ]);
        });

        test('Not allowed: A platform admin cannot filter on record answer if no permission for all members', async () => {
            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [] })
                .create();

            const recordCategory = await new RecordCategoryFactory({
                records: [
                    {
                        type: RecordType.Text,
                    },
                ],
            }).create();

            await initPlatformRecordCategory({ recordCategory });
            const record = recordCategory.records[0];
            const group = await new GroupFactory({ organization, period }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.Groups, new Map([[
                            PermissionsResourceKey.CurrentPeriod,
                            ResourcePermissions.create({
                                level: PermissionLevel.Full,
                                accessRights: [],
                            }),
                        ]]),
                    ]]),
                }),
                globalPermissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();

            // Make sure member1 has answered the question
            const answer = RecordTextAnswer.create({ settings: record });
            answer.value = 'This has been answered';
            member1.details.recordAnswers.set(record.id, answer);
            await member1.save();

            resources.set(
                PermissionsResourceType.OrganizationTags, new Map([[
                    'tagtest',
                    ResourcePermissions.create({
                        level: PermissionLevel.Full,
                        accessRights: [],
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                        details: {
                            recordAnswers: {
                                [record.id]: {
                                    value: {
                                        $contains: 'has been',
                                    },
                                },
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });
    });

    describe('Default filtering', () => {
        test('A user without read permissions for all groups will only see members of membership groups', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();
            const member3 = await new MemberFactory({ }).create();
            const member4 = await new MemberFactory({ }).create();
            const group = await new GroupFactory({ organization, period }).create();
            const group2 = await new GroupFactory({ organization, period }).create();
            const group3 = await new GroupFactory({ organization, period }).create();

            const group4 = await new GroupFactory({ organization, period, type: GroupType.EventRegistration }).create();

            // Give permission for 2 / 3 groups + one event group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ], [
                    group2.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Write,
                    }),
                ], [
                    group4.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group: group2 }).create();
            await new RegistrationFactory({ member: member3, group: group3 }).create();
            await new RegistrationFactory({ member: member4, group: group4 }).create();

            // Try to request all members
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            // Response only includes members registered in a membership group, not the event group
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(2);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
                expect.objectContaining({ id: member2.id }),
            ]);
        });

        test('A user with read permissions for all groups will also see members of event groups', async () => {
            // Same test, but without giving the user permissions to read the group
            // Setup
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const member2 = await new MemberFactory({ }).create();
            const member3 = await new MemberFactory({ }).create();
            const member4 = await new MemberFactory({ }).create();
            const group = await new GroupFactory({ organization, period }).create();
            const group2 = await new GroupFactory({ organization, period }).create();
            const group3 = await new GroupFactory({ organization, period }).create();

            const group4 = await new GroupFactory({ organization, period, type: GroupType.EventRegistration }).create();

            // Give permission to all groups
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    PermissionsResourceKey.CurrentPeriod,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group: group2 }).create();
            await new RegistrationFactory({ member: member3, group: group3 }).create();
            await new RegistrationFactory({ member: member4, group: group4 }).create();

            // Try to request all members
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            // Response only includes members registered in a membership group, not the event group
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(4);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
                expect.objectContaining({ id: member2.id }),
                expect.objectContaining({ id: member3.id }),
                expect.objectContaining({ id: member4.id }),
            ]);
        });
    });

    describe('Language filtering', () => {
        async function setup() {
            const organization = await new OrganizationFactory({ period })
                .create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const group = await new GroupFactory({ organization, period }).create();

            const frenchMember = await new MemberFactory({ }).create();
            frenchMember.details.language = Language.French;
            await frenchMember.save();

            const dutchMember = await new MemberFactory({ }).create();
            dutchMember.details.language = Language.Dutch;
            await dutchMember.save();

            const defaultMember = await new MemberFactory({ }).create();

            await new RegistrationFactory({ member: frenchMember, group }).create();
            await new RegistrationFactory({ member: dutchMember, group }).create();
            await new RegistrationFactory({ member: defaultMember, group }).create();

            return { organization, token, frenchMember, dutchMember, defaultMember };
        }

        async function fetchMembers(organization: Awaited<ReturnType<typeof setup>>['organization'], token: Token, filter: StamhoofdFilter) {
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter,
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            return response.body.results.members;
        }

        test('Members can be filtered on their language', async () => {
            const { organization, token, frenchMember } = await setup();

            const members = await fetchMembers(organization, token, {
                language: {
                    $in: [Language.French],
                },
            });

            expect(members).toIncludeSameMembers([
                expect.objectContaining({ id: frenchMember.id }),
            ]);
        });

        test('Members without a language can be filtered together with a language', async () => {
            const { organization, token, dutchMember, defaultMember } = await setup();

            const members = await fetchMembers(organization, token, {
                language: {
                    $in: [null, Language.Dutch],
                },
            });

            expect(members).toIncludeSameMembers([
                expect.objectContaining({ id: dutchMember.id }),
                expect.objectContaining({ id: defaultMember.id }),
            ]);
        });
    });

    describe('Record answer filtering', () => {
        test('A user can filter members on the date of a date record answer', async () => {
            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [] })
                .create();

            const recordCategory = await new RecordCategoryFactory({
                records: [
                    {
                        type: RecordType.Date,
                    },
                ],
            }).create();

            await initPlatformRecordCategory({ recordCategory });
            const record = recordCategory.records[0];

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);

            // The member we are looking for: answered with a time of day that is not midnight
            const member1 = await new MemberFactory({}).create();
            const answer1 = RecordDateAnswer.create({ settings: record });
            answer1.dateValue = new Date(2023, 5, 10, 14, 30, 15);
            member1.details.recordAnswers.set(record.id, answer1);
            await member1.save();

            // Answered with a different date
            const member2 = await new MemberFactory({}).create();
            const answer2 = RecordDateAnswer.create({ settings: record });
            answer2.dateValue = new Date(2023, 5, 11, 14, 30, 15);
            member2.details.recordAnswers.set(record.id, answer2);
            await member2.save();

            // Did not answer the question
            const member3 = await new MemberFactory({}).create();

            const group = await new GroupFactory({ organization, period }).create();

            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                        accessRights: [],
                    }),
                ]]),
            );

            resources.set(
                PermissionsResourceType.RecordCategories, new Map([[
                    recordCategory.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                        accessRights: [],
                    }),
                ]]),
            );

            await user.save();

            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member2, group }).create();
            await new RegistrationFactory({ member: member3, group }).create();

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                        details: {
                            recordAnswers: {
                                [record.id]: {
                                    // Same filter as the date filter in the UI builds for 'equals'
                                    $and: [
                                        {
                                            dateValue: {
                                                $gte: new Date(2023, 5, 10),
                                            },
                                        },
                                        {
                                            dateValue: {
                                                $lte: new Date(2023, 5, 10, 23, 59, 59, 999),
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
            ]);
        });

        test('[REGRESSION] A user with minimal access can also view platform record answers in platform scope', async () => {
            /**
             * When fetching members via the admin api, without organization scope, we need to calculate which records to return and which not.
             * This test makes sure we check all registrations of the member to know whether we can return a platform record cateogry answer.
             */
            const role = PermissionRoleDetailed.create({
                name: 'Stamhoofd verantwoordelijke',
                level: PermissionLevel.None,
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const recordCategory = await new RecordCategoryFactory({
                records: [
                    {
                        type: RecordType.Text,
                    },
                ],
            }).create();

            // Add a record category the admin does not have access to
            const controlRecordCategory = await new RecordCategoryFactory({
                records: [
                    {
                        type: RecordType.Text,
                    },
                ],
            }).create();

            await initPlatformRecordCategory({ recordCategory });
            await initPlatformRecordCategory({ recordCategory: controlRecordCategory });
            const record = recordCategory.records[0];
            const controlRecord = controlRecordCategory.records[0];

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const group = await new GroupFactory({ organization, period }).create();

            // Make sure member1 has answered the question
            const answer = RecordTextAnswer.create({ settings: record });
            answer.value = 'This has been answered';
            member1.details.recordAnswers.set(record.id, answer);

            const controlAnswer = RecordTextAnswer.create({ settings: controlRecord });
            controlAnswer.value = 'This should be invisible';
            member1.details.recordAnswers.set(controlRecord.id, controlAnswer);
            await member1.save();

            // Give read permission to the group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            // Give permission to read the record category
            resources.set(
                PermissionsResourceType.RecordCategories, new Map([[
                    recordCategory.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            await user.save();

            // Register the memebr for group
            await new RegistrationFactory({ member: member1, group }).create();

            // Try to request all members
            const request = Request.get({
                path: baseUrl,
                query: new LimitedFilteredRequest({
                    limit: 10,
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                    },
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            // Response only includes members registered in a membership group, not the event group
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(1);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
            ]);

            const returnedMember = response.body.results.members[0];

            // Check only one record answer returned
            expect(returnedMember.details.recordAnswers.size).toEqual(1);

            expect(returnedMember.details.recordAnswers.get(record.id)).toMatchObject({
                value: 'This has been answered',
                settings: expect.objectContaining({
                    id: record.id,
                }),
            });
        });

        test('[REGRESSION] A user with full access to a single organization can also view platform record answers in platform scope', async () => {
            /**
             * When fetching members via the admin api, without organization scope, we need to calculate which records to return and which not.
             * This test makes sure we check all registrations of the member to know whether we can return a platform record cateogry answer.
             */
            const role = PermissionRoleDetailed.create({
                name: 'Stamhoofd verantwoordelijke',
                level: PermissionLevel.Full,
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();

            const recordCategory = await new RecordCategoryFactory({
                records: [
                    {
                        type: RecordType.Text,
                    },
                ],
            }).create();

            // Add a record category the admin does not have access to
            const controlRecordCategory = await new RecordCategoryFactory({
                records: [
                    {
                        type: RecordType.Text,
                    },
                ],
            }).create();

            await initPlatformRecordCategory({ recordCategory });
            await initPlatformRecordCategory({ recordCategory: controlRecordCategory });
            const record = recordCategory.records[0];
            const controlRecord = controlRecordCategory.records[0];

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const group = await new GroupFactory({ organization, period }).create();

            // Make sure member1 has answered the question
            const answer = RecordTextAnswer.create({ settings: record });
            answer.value = 'This has been answered';
            member1.details.recordAnswers.set(record.id, answer);

            const controlAnswer = RecordTextAnswer.create({ settings: controlRecord });
            controlAnswer.value = 'This should be invisible';
            member1.details.recordAnswers.set(controlRecord.id, controlAnswer);
            await member1.save();

            // Register the memebr for group
            await new RegistrationFactory({ member: member1, group }).create();

            // Try to request all members
            const request = Request.get({
                path: baseUrl,
                query: new LimitedFilteredRequest({
                    limit: 10,
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: group.id,
                            },
                        },
                    },
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            // Response only includes members registered in a membership group, not the event group
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(1);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
            ]);

            const returnedMember = response.body.results.members[0];

            // Check only one record answer returned
            expect(returnedMember.details.recordAnswers.size).toEqual(2);
        });

        test('[REGRESSION] A user with full access to a single organization cannot view platform record answers in platform scope of member of different organization', async () => {
            /**
             * Case:
             * - organization1 gives read access to the member, not the record category
             * - organization2 gives read access to the member and record category
             *
             * member is registered at organization1, and at organization2 (but in a group the user does not have access to)
             * -> cannot see answer
             */
            const resources = new Map();
            const resources2 = new Map();

            const organization = await new OrganizationFactory({ period, roles: [] }).create();
            const organization2 = await new OrganizationFactory({ period, roles: [] }).create();

            const recordCategory = await new RecordCategoryFactory({
                records: [
                    {
                        type: RecordType.Text,
                    },
                ],
            }).create();

            // Add a record category the admin does not have access to
            const controlRecordCategory = await new RecordCategoryFactory({
                records: [
                    {
                        type: RecordType.Text,
                    },
                ],
            }).create();

            await initPlatformRecordCategory({ recordCategory });
            await initPlatformRecordCategory({ recordCategory: controlRecordCategory });
            const record = recordCategory.records[0];
            const controlRecord = controlRecordCategory.records[0];

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);
            const member1 = await new MemberFactory({ }).create();
            const controlMember = await new MemberFactory({ }).create();
            const group = await new GroupFactory({ organization, period }).create();
            const unauthorizedGroup = await new GroupFactory({ organization, period }).create();
            const controlGroup = await new GroupFactory({ organization: organization2, period }).create();

            // Make sure member1 has answered the question
            const answer = RecordTextAnswer.create({ settings: record });
            answer.value = 'This has been answered';
            member1.details.recordAnswers.set(record.id, answer);

            const controlAnswer = RecordTextAnswer.create({ settings: controlRecord });
            controlAnswer.value = 'This should be invisible';
            member1.details.recordAnswers.set(controlRecord.id, controlAnswer);
            await member1.save();

            // Make sure member1 has answered the question
            const controlMemberAnswer = RecordTextAnswer.create({ settings: record });
            controlMemberAnswer.value = 'This has been answered control';
            controlMember.details.recordAnswers.set(record.id, controlMemberAnswer);

            const controlMemberControlAnswer = RecordTextAnswer.create({ settings: controlRecord });
            controlMemberControlAnswer.value = 'This should be invisible';
            controlMember.details.recordAnswers.set(controlRecord.id, controlMemberControlAnswer);
            await controlMember.save();

            // Give read permission to the group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    group.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            // Do not give permission to read the record category

            // Give read permission to the control group
            resources2.set(
                PermissionsResourceType.Groups, new Map([[
                    controlGroup.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            // Give permission to read the record category
            resources2.set(
                PermissionsResourceType.RecordCategories, new Map([[
                    recordCategory.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );

            // Add permission for organization2
            user.permissions!.organizationPermissions.set(organization2.id, Permissions.create({
                level: PermissionLevel.None,
                resources: resources2,
            }));
            await user.save();

            // Register the memebr for group
            await new RegistrationFactory({ member: member1, group }).create();
            await new RegistrationFactory({ member: member1, group: unauthorizedGroup }).create();
            await new RegistrationFactory({ member: controlMember, group: controlGroup }).create();

            // Try to request all members
            const request = Request.get({
                path: baseUrl,
                query: new LimitedFilteredRequest({
                    limit: 10,
                    filter: {
                        registrations: {
                            $elemMatch: {
                                groupId: {
                                    $in: [
                                        group.id, controlGroup.id,
                                    ],
                                },
                            },
                        },
                    },
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            // Response only includes members registered in a membership group, not the event group
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(2);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member1.id }),
                expect.objectContaining({ id: controlMember.id }),
            ]);

            const returnedMember = response.body.results.members.find(m => m.id === member1.id)!;
            const returnedControlMember = response.body.results.members.find(m => m.id === controlMember.id)!;

            expect(returnedMember).toBeDefined();
            expect(returnedControlMember).toBeDefined();

            // Check only one record answer returned
            expect(returnedMember.details.recordAnswers.size).toEqual(0);
            expect(returnedControlMember.details.recordAnswers.size).toEqual(1);

            expect(returnedControlMember.details.recordAnswers.get(record.id)).toMatchObject({
                value: 'This has been answered control',
                settings: expect.objectContaining({
                    id: record.id,
                }),
            });
        });
    });

    // Returned registrations in the members
    describe('Filtering registrations', () => {
        test('[REGRESSION] Deactivated registrations are returned when having access to that group', async () => {
            /**
             * Note: a deactivated registration doesn't give an admin access to a member, so we need an
             * extra registration so the admin does have acess to the member and can fetch it.
             * Next, we add two deactivated registrations: one for a group we have access to, one without. We should only see the one with access of course.
             */

            const role = PermissionRoleDetailed.create({
                name: 'Stamhoofd verantwoordelijke',
                level: PermissionLevel.None,
                accessRights: [],
            });

            const resources = new Map();

            const organization = await new OrganizationFactory({ period, roles: [role] })
                .create();
            const member = await new MemberFactory({ }).create();

            // Group we have access for, but with an active registration
            const accessGroup = await new GroupFactory({
                organization,
                period,
            }).create();

            // Deactivated, with access
            const deactivatedGroup = await new GroupFactory({
                organization,
                period,
            }).create();

            // Deactivated, without access
            const deactivatedControlGroup = await new GroupFactory({
                organization,
                period,
            }).create();

            // Create 3 registrations with each group
            const accessRegistration = await new RegistrationFactory({
                group: accessGroup,
                member,
            }).create();

            const deactivatedRegistration = await new RegistrationFactory({
                group: deactivatedGroup,
                member,
                deactivatedAt: new Date(),
            }).create();

            // deactivatedControlRegistration
            await new RegistrationFactory({
                group: deactivatedControlGroup,
                member,
                deactivatedAt: new Date(),
            }).create();

            // Give read permission to the group
            resources.set(
                PermissionsResourceType.Groups, new Map([[
                    accessGroup.id,
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ], [
                    deactivatedGroup.id, // not for the control group
                    ResourcePermissions.create({
                        level: PermissionLevel.Read,
                    }),
                ]]),
            );
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [
                        role,
                    ],
                    resources,
                }),
            })
                .create();

            const token = await SessionService.createSession(user);

            // Try to request all members at organization
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(1);
            expect(response.body.results.members).toIncludeSameMembers([
                expect.objectContaining({ id: member.id }),
            ]);

            const returnedMember = response.body.results.members[0];

            // Check only one record answer returned
            expect(returnedMember.registrations.length).toEqual(2);

            expect(returnedMember.registrations).toIncludeSameMembers([
                expect.objectContaining({ id: accessRegistration.id, deactivatedAt: null }),
                expect.objectContaining({ id: deactivatedRegistration.id, deactivatedAt: deactivatedRegistration.deactivatedAt }),
            ]);
        });
    });

    describe('Sorting', () => {
        // Deliberately not in chronological order, so a passing test cannot be explained by insertion order
        const january = new Date(Date.UTC(2023, 0, 10, 8, 30, 0));
        const february = new Date(Date.UTC(2023, 1, 1, 0, 0, 0));
        const march = new Date(Date.UTC(2023, 2, 5, 12, 0, 0));
        const may = new Date(Date.UTC(2023, 4, 15, 16, 45, 0));
        const june = new Date(Date.UTC(2023, 5, 20, 22, 15, 0));

        /**
         * Creates one member per passed value, all registered in the same group of a new organization,
         * and returns an admin with full access to that organization.
         */
        async function setupMembers(lastRegisteredAtValues: (Date | null)[]) {
            const organization = await new OrganizationFactory({ period }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            }).create();

            const token = await SessionService.createSession(user);
            const group = await new GroupFactory({ organization, period }).create();

            const members: MemberWithUsersRegistrationsAndGroups[] = [];

            for (const lastRegisteredAt of lastRegisteredAtValues) {
                const member = await new MemberFactory({}).create();
                await new RegistrationFactory({ member, group }).create();

                // The registration factory does not maintain lastRegisteredAt (only RegistrationService does),
                // so we set it explicitly to get deterministic values - including legacy members that never got one.
                member.lastRegisteredAt = lastRegisteredAt;
                await member.save();

                members.push(member);
            }

            return { host: organization.getApiHost(), token, members };
        }

        /**
         * Requests every page by following the 'next' request the endpoint returns, exactly like the frontend does.
         * That next request is built from the sorter's getValue, so this covers the full sort + pagination flow:
         * getValue -> page filter -> encoded in the query -> decoded -> compiled back to SQL.
         *
         * Returns the ids of all members across all pages, in the order they were received.
         */
        async function fetchAllPages({ host, token, sort, limit }: { host: string; token: Token; sort: SortList; limit: number }) {
            const ids: string[] = [];
            let query: LimitedFilteredRequest | undefined = new LimitedFilteredRequest({ sort, limit });
            let pages = 0;

            while (query) {
                const request = Request.get({
                    path: baseUrl,
                    host,
                    query,
                    headers: {
                        authorization: 'Bearer ' + token.accessToken,
                    },
                });

                const response = await testServer.test(endpoint, request);
                expect(response.status).toBe(200);

                ids.push(...response.body.results.members.map(m => m.id));
                query = response.body.next;
                pages += 1;

                if (pages > 10) {
                    throw new Error('Pagination did not terminate');
                }
            }

            return ids;
        }

        test('Members are sorted by lastRegisteredAt ascending across all pages', async () => {
            const { host, token, members } = await setupMembers([march, january, june, february, may]);
            const [marchMember, januaryMember, juneMember, februaryMember, mayMember] = members;

            // A limit lower than the total forces the endpoint to build a next page filter from getValue
            const ids = await fetchAllPages({
                host,
                token,
                sort: [{ key: 'lastRegisteredAt', order: SortItemDirection.ASC }],
                limit: 2,
            });

            expect(ids).toEqual([
                januaryMember.id,
                februaryMember.id,
                marchMember.id,
                mayMember.id,
                juneMember.id,
            ]);
        });

        test('Members are sorted by lastRegisteredAt descending across all pages', async () => {
            const { host, token, members } = await setupMembers([march, january, june, february, may]);
            const [marchMember, januaryMember, juneMember, februaryMember, mayMember] = members;

            const ids = await fetchAllPages({
                host,
                token,
                sort: [{ key: 'lastRegisteredAt', order: SortItemDirection.DESC }],
                limit: 2,
            });

            expect(ids).toEqual([
                juneMember.id,
                mayMember.id,
                marchMember.id,
                februaryMember.id,
                januaryMember.id,
            ]);
        });

        test('Members without a lastRegisteredAt are sorted first when ascending', async () => {
            const { host, token, members } = await setupMembers([march, null, january]);
            const [marchMember, neverRegisteredMember, januaryMember] = members;

            // A limit of 1 puts the page boundary right after the member without a lastRegisteredAt,
            // so the next page filter is built from a null value.
            const ids = await fetchAllPages({
                host,
                token,
                sort: [{ key: 'lastRegisteredAt', order: SortItemDirection.ASC }],
                limit: 1,
            });

            expect(ids).toEqual([
                neverRegisteredMember.id,
                januaryMember.id,
                marchMember.id,
            ]);
        });

        test('Members without a lastRegisteredAt are sorted last when descending', async () => {
            const { host, token, members } = await setupMembers([march, null, january]);
            const [marchMember, neverRegisteredMember, januaryMember] = members;

            const ids = await fetchAllPages({
                host,
                token,
                sort: [{ key: 'lastRegisteredAt', order: SortItemDirection.DESC }],
                limit: 1,
            });

            expect(ids).toEqual([
                marchMember.id,
                januaryMember.id,
                neverRegisteredMember.id,
            ]);
        });

        test('The next page filter compares lastRegisteredAt as a UTC datetime string', async () => {
            const { host, token, members } = await setupMembers([january, february]);
            const [januaryMember] = members;

            const request = Request.get({
                path: baseUrl,
                host,
                query: new LimitedFilteredRequest({
                    sort: [{ key: 'lastRegisteredAt', order: SortItemDirection.ASC }],
                    limit: 1,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(1);

            // The value has to be formatted in UTC, because that is how MySQL stores the datetime column.
            // Comparing against a raw Date or a localized string would shift the page boundary.
            expect(response.body.next?.pageFilter).toMatchObject({
                $or: [
                    { lastRegisteredAt: { $gt: '2023-01-10 08:30:00' } },
                    {
                        $and: [
                            { lastRegisteredAt: '2023-01-10 08:30:00' },
                            { id: { $gt: januaryMember.id } },
                        ],
                    },
                ],
            });
        });

        test('Members are sorted by createdAt across all pages, even if they never registered', async () => {
            const { host, token, members } = await setupMembers([null, null, null]);
            const [first, second, third] = members;

            // createdAt keeps an explicitly set value on save
            first.createdAt = march;
            second.createdAt = january;
            third.createdAt = february;

            await first.save();
            await second.save();
            await third.save();

            const ids = await fetchAllPages({
                host,
                token,
                sort: [{ key: 'createdAt', order: SortItemDirection.ASC }],
                limit: 1,
            });

            expect(ids).toEqual([
                second.id,
                third.id,
                first.id,
            ]);
        });
    });

    describe('Member balance financial data', () => {
        const balance = 123_450000;

        /**
         * Registers a member with an open balance, together with a user that can only read the
         * group that member is registered in, and that only carries the passed access rights.
         */
        async function setupMemberWithBalance(accessRights: AccessRight[]) {
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights,
            });

            const organization = await new OrganizationFactory({ period, roles: [role] }).create();
            const group = await new GroupFactory({ organization, period }).create();

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
            const member = await new MemberFactory({}).create();
            const registration = await new RegistrationFactory({ member, group }).create();

            await new BalanceItemFactory({
                organizationId: organization.id,
                memberId: member.id,
                registrationId: registration.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: balance,
                status: BalanceItemStatus.Due,
            }).create();

            // The filters read the cached balance, not the balance items themselves
            await CachedBalance.updateForMembers(organization.id, [member.id]);
            await CachedBalance.updateForRegistrations(organization.id, [registration.id]);

            return { organization, member, token };
        }

        async function filterOnBalance({ organization, token, filter }: { organization: Organization; token: Token; filter: StamhoofdFilter }) {
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        registrations: {
                            $elemMatch: {
                                $and: [{ organizationId: organization.id }, filter],
                            },
                        },
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            return await testServer.test(endpoint, request);
        }

        test('A user without MemberReadFinancialData cannot filter members on their balance', async () => {
            const { organization, token } = await setupMemberWithBalance([]);

            // Repeating this request with different amounts narrows down the exact balance of a member
            await expect(filterOnBalance({ organization, token, filter: { memberCachedBalance: { amountOpen: { $gt: balance - 1 } } } })).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
            await expect(filterOnBalance({ organization, token, filter: { registrationCachedBalance: { toPay: { $gt: balance - 1 } } } })).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('A user with MemberReadFinancialData can filter members on their balance', async () => {
            const { organization, member, token } = await setupMemberWithBalance([AccessRight.MemberReadFinancialData]);

            const response = await filterOnBalance({ organization, token, filter: { memberCachedBalance: { amountOpen: { $gt: balance - 1 } } } });
            expect(response.body.results.members.map(m => m.id)).toEqual([member.id]);
        });
    });

    describe('Platform membership financial data', () => {
        const membershipPrice = 3000;
        const membershipPriceWithoutDiscount = 4000;
        const membershipFreeAmount = 500;

        /**
         * Registers a member in a new organization and gives them a platform membership with a price,
         * together with a user whose role only carries the passed access rights.
         */
        async function setupMemberWithMembership(accessRights: AccessRight[]) {
            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights,
            });

            const organization = await new OrganizationFactory({ period, roles: [role] }).create();
            const group = await new GroupFactory({ organization, period }).create();

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
            const member = await new MemberFactory({}).create();
            await new RegistrationFactory({ member, group }).create();

            const membership = new MemberPlatformMembership();
            membership.memberId = member.id;
            membership.membershipTypeId = uuidv4();
            membership.organizationId = organization.id;
            membership.periodId = period.id;
            membership.startDate = period.startDate;
            membership.endDate = period.endDate;
            membership.price = membershipPrice;
            membership.priceWithoutDiscount = membershipPriceWithoutDiscount;
            membership.freeAmount = membershipFreeAmount;
            await membership.save();

            return { organization, member, membership, token };
        }

        async function fetchMember({ organization, token, memberId }: { organization: Organization; token: Token; memberId: string }) {
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        id: memberId,
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members).toHaveLength(1);

            return response.body.results.members[0];
        }

        test('A user without MemberReadFinancialData cannot filter members on the price of a platform membership', async () => {
            const { organization, token } = await setupMemberWithMembership([]);

            const filterOnPrice = async (filter: StamhoofdFilter) => {
                const request = Request.get({
                    path: baseUrl,
                    host: organization.getApiHost(),
                    query: new LimitedFilteredRequest({
                        filter: { platformMemberships: { $elemMatch: filter } },
                        limit: 10,
                    }),
                    headers: {
                        authorization: 'Bearer ' + token.accessToken,
                    },
                });

                return await testServer.test(endpoint, request);
            };

            await expect(filterOnPrice({ price: { $eq: membershipPrice } })).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
            await expect(filterOnPrice({ priceWithoutDiscount: { $gt: membershipPrice - 1000 } })).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('A user with MemberReadFinancialData can filter members on the price of a platform membership', async () => {
            const { organization, member, token } = await setupMemberWithMembership([AccessRight.MemberReadFinancialData]);

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: { platformMemberships: { $elemMatch: { price: { $eq: membershipPrice } } } },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.members.map(m => m.id)).toEqual([member.id]);
        });

        test('A user with MemberReadFinancialData can see the price of a platform membership', async () => {
            const { organization, member, token } = await setupMemberWithMembership([AccessRight.MemberReadFinancialData]);

            const blob = await fetchMember({ organization, token, memberId: member.id });

            expect(blob.platformMemberships).toHaveLength(1);
            expect(blob.platformMemberships[0]).toMatchObject({
                price: membershipPrice,
                priceWithoutDiscount: membershipPriceWithoutDiscount,
            });
        });

        test('A user without MemberReadFinancialData cannot see the price of a platform membership', async () => {
            const { organization, member, token } = await setupMemberWithMembership([]);

            const blob = await fetchMember({ organization, token, memberId: member.id });

            // The membership itself stays visible: only its price is hidden
            expect(blob.platformMemberships).toHaveLength(1);
            expect(blob.platformMemberships[0]).toMatchObject({
                price: null,
                priceWithoutDiscount: null,
            });
        });
    });
});
