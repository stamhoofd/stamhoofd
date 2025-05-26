import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { EventFactory, GroupFactory, MemberFactory, OrganizationFactory, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { AccessRight, EventMeta, GroupType, LimitedFilteredRequest, NamedObject, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { GetMembersEndpoint } from './GetMembersEndpoint';
import { testServer } from '../../../../tests/helpers/TestServer';

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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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
                    '',
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
});
