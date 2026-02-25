import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { EventFactory, GroupFactory, MemberFactory, OrganizationFactory, RecordCategoryFactory, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { AccessRight, EventMeta, GroupType, LimitedFilteredRequest, NamedObject, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, RecordAnswer, RecordTextAnswer, RecordType, ResourcePermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { GetMembersEndpoint } from './GetMembersEndpoint.js';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initPlatformRecordCategory } from '../../../../tests/init/initPlatformRecordCategory.js';

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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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
                    '',
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
                            '',
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

            const token = await Token.createToken(user);
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

    describe('Record answer filtering', () => {
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);
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

            const token = await Token.createToken(user);

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
});
