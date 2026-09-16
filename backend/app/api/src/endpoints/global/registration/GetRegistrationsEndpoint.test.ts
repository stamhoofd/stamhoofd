import { Request } from '@simonbackx/simple-endpoints';
import type { Group, Organization, Registration, RegistrationPeriod, Token } from '@stamhoofd/models';
import { BalanceItemFactory, CachedBalance, EventFactory, GroupFactory, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import type { SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { AccessRight, BalanceItemStatus, BalanceItemType, EventMeta, GroupCategory, GroupCategorySettings, GroupPrice, GroupType, LimitedFilteredRequest, NamedObject, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceKey, PermissionsResourceType, ResourcePermissions, SortItemDirection, TranslatedString } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetRegistrationsEndpoint } from './GetRegistrationsEndpoint.js';
import { SessionService } from '../../../services/SessionService.js';

const baseUrl = `/registrations`;
const endpoint = new GetRegistrationsEndpoint();

describe('Endpoint.GetRegistrationsEndpoint', () => {
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
        test('Allowed: Can fetch registrations for a given group', async () => {
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

            const registration1 = await new RegistrationFactory({ member: member1, group }).create();
            const registration2 = await new RegistrationFactory({ member: member2, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        groupId: group.id,
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.registrations).toHaveLength(2);

            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.registrations).toIncludeSameMembers([
                expect.objectContaining({ id: registration1.id }),
                expect.objectContaining({ id: registration2.id }),
            ]);
        });

        test('Not allowed: Cannot fetch registrations for a given group', async () => {
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
                        groupId: group.id,
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

        test('Allowed: Can fetch registrations for multiple groups at the same time', async () => {
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

            const registration1 = await new RegistrationFactory({ member: member1, group }).create();
            const registration2 = await new RegistrationFactory({ member: member2, group: group2 }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        groupId: {
                            $in: [group.id, group2.id],
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
            expect(response.body.results.registrations).toHaveLength(2);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.registrations).toIncludeSameMembers([
                expect.objectContaining({ id: registration1.id }),
                expect.objectContaining({ id: registration2.id }),
            ]);
        });

        test('Not allowed: Cannot fetch registrations for multiple groups at the same time if no permissions for one of them', async () => {
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
                        groupId: {
                            $in: [group.id, group2.id],
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

        test('Allowed: Can fetch all registrations if permissions for at least one group', async () => {
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

            const registration1 = await new RegistrationFactory({ member: member1, group }).create();
            const registration2 = await new RegistrationFactory({ member: member2, group: group2 }).create();
            await new RegistrationFactory({ member: member3, group: group3 }).create();

            // Try to request registrations for this group
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
            expect(response.body.results.registrations).toHaveLength(2);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.registrations).toIncludeSameMembers([
                expect.objectContaining({ id: registration1.id }),
                expect.objectContaining({ id: registration2.id }),
            ]);
        });

        test('Not allowed: Cannot fetch all registrations if no permissions for a single group', async () => {
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
            await new EventFactory({
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

            const registration1 = await new RegistrationFactory({ member: member1, group }).create();
            const registration2 = await new RegistrationFactory({ member: member2, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        groupId: group.id,
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.registrations).toHaveLength(2);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.registrations).toIncludeSameMembers([
                expect.objectContaining({ id: registration1.id }),
                expect.objectContaining({ id: registration2.id }),
            ]);
        });

        test('Allowed: A user with a grant on an event of a previous period can fetch its registrations', async () => {
            const previousPeriod = await new RegistrationPeriodFactory({
                startDate: new Date(2022, 0, 1),
                endDate: new Date(2022, 11, 31),
            }).create();

            // The organization already moved on to `period`
            const organization = await new OrganizationFactory({ period }).create();

            const group = await new GroupFactory({ organization, period: previousPeriod, type: GroupType.EventRegistration }).create();
            const event = await new EventFactory({
                organization,
                group,
                startDate: previousPeriod.startDate,
                endDate: previousPeriod.endDate,
            }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.Events,
                        new Map([[event.id, ResourcePermissions.create({ level: PermissionLevel.Write })]]),
                    ]]),
                }),
            }).create();

            const token = await SessionService.createSession(user);
            const member = await new MemberFactory({}).create();
            const registration = await new RegistrationFactory({ member, group }).create();

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    // The shape RegistrationsTableView sends for a group
                    // mergeFilters combines the table's required filters into an $and as soon
                    // as there is more than one part, which hides the group ids from the root
                    filter: {
                        $and: [
                            {
                                groupId: group.id,
                                deactivatedAt: null,
                            },
                            {
                                registeredAt: { $neq: null },
                            },
                        ],
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.registrations).toIncludeSameMembers([
                expect.objectContaining({ id: registration.id }),
            ]);
        });

        test('Allowed: A category grant does not filter away the registrations of a granted event', async () => {
            // Reported from organization mode, but the scoping this covers is the same in both
            const previousPeriod = await new RegistrationPeriodFactory({
                startDate: new Date(2022, 0, 1),
                endDate: new Date(2022, 11, 31),
            }).create();

            const organization = await new OrganizationFactory({ period }).create();

            // A membership group in a granted category of the previous period
            const membershipGroup = await new GroupFactory({ organization, period: previousPeriod }).create();
            const category = GroupCategory.create({
                settings: GroupCategorySettings.create({ name: 'Takken' }),
                groupIds: [membershipGroup.id],
            });

            const organizationPeriod = await new OrganizationRegistrationPeriodFactory({
                organization,
                period: previousPeriod,
            }).create();
            organizationPeriod.settings.categories.push(category);
            organizationPeriod.settings.rootCategory?.categoryIds.push(category.id);
            await organizationPeriod.save();

            // The event, in the same previous period, with a participant who is not a member of
            // any group of the granted category
            const eventGroup = await new GroupFactory({ organization, period: previousPeriod, type: GroupType.EventRegistration }).create();
            const event = await new EventFactory({
                organization,
                group: eventGroup,
                startDate: previousPeriod.startDate,
                endDate: previousPeriod.endDate,
            }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([
                        [PermissionsResourceType.GroupCategories, new Map([[category.id, ResourcePermissions.create({ level: PermissionLevel.Write })]])],
                        [PermissionsResourceType.Events, new Map([[event.id, ResourcePermissions.create({ level: PermissionLevel.Write })]])],
                    ]),
                }),
            }).create();

            const token = await SessionService.createSession(user);
            const participant = await new MemberFactory({}).create();
            const registration = await new RegistrationFactory({ member: participant, group: eventGroup }).create();

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    // The shape the table sends once a UI filter is active: mergeFilters puts the
                    // built UI filter (itself an $and) next to the required group filter
                    filter: {
                        $and: [
                            {
                                $and: [
                                    { registeredAt: { $neq: null } },
                                    { deactivatedAt: null },
                                ],
                            },
                            {
                                groupId: eventGroup.id,
                                deactivatedAt: null,
                            },
                        ],
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.registrations).toIncludeSameMembers([
                expect.objectContaining({ id: registration.id }),
            ]);
        });

        test('Not allowed: An event only role gets a clear error instead of an empty list without a group filter', async () => {
            const previousPeriod = await new RegistrationPeriodFactory({
                startDate: new Date(2022, 0, 1),
                endDate: new Date(2022, 11, 31),
            }).create();

            const organization = await new OrganizationFactory({ period }).create();
            const eventGroup = await new GroupFactory({ organization, period: previousPeriod, type: GroupType.EventRegistration }).create();
            const event = await new EventFactory({
                organization,
                group: eventGroup,
                startDate: previousPeriod.startDate,
                endDate: previousPeriod.endDate,
            }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.Events,
                        new Map([[event.id, ResourcePermissions.create({ level: PermissionLevel.Write })]]),
                    ]]),
                }),
            }).create();

            const token = await SessionService.createSession(user);
            const member = await new MemberFactory({}).create();
            await new RegistrationFactory({ member, group: eventGroup }).create();

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ limit: 10 }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            // The scope filter only covers membership groups, so there is nothing to show: that
            // has to surface as an error, never as a silently empty list.
            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
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

            await new EventFactory({
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

            const registration1 = await new RegistrationFactory({ member: member1, group: waitingList }).create();
            const registration2 = await new RegistrationFactory({ member: member2, group: waitingList }).create();
            await new RegistrationFactory({ member: member3, group }).create();

            // Try to request members for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        groupId: waitingList.id,
                    },
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.registrations).toHaveLength(2);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.registrations).toIncludeSameMembers([
                expect.objectContaining({ id: registration1.id }),
                expect.objectContaining({ id: registration2.id }),
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
            await new EventFactory({
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

            // The user can read registrations for default group, but not events for default group
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

            // Try to request registrations for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        groupId: group.id,
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

        test('Not allowed: A user cannot request all registrations if only access to events for a single group', async () => {
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
            await new EventFactory({
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

            // Try to request registrations for this group
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        groupId: group.id,
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

            await new EventFactory({
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
                        groupId: waitingList.id,
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
        test('A user without read permissions for all groups will only see registrations of membership groups', async () => {
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

            const registration1 = await new RegistrationFactory({ member: member1, group }).create();
            const registration2 = await new RegistrationFactory({ member: member2, group: group2 }).create();
            await new RegistrationFactory({ member: member3, group: group3 }).create();
            await new RegistrationFactory({ member: member4, group: group4 }).create();

            // Try to request all registrations
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

            // Response only includes registrations for a membership group, not the event group
            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results.registrations).toHaveLength(2);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.registrations).toIncludeSameMembers([
                expect.objectContaining({ id: registration1.id }),
                expect.objectContaining({ id: registration2.id }),
            ]);
        });

        test('A user with read permissions for all groups will also see registrations for event groups', async () => {
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

            const registration1 = await new RegistrationFactory({ member: member1, group }).create();
            const registration2 = await new RegistrationFactory({ member: member2, group: group2 }).create();
            const registration3 = await new RegistrationFactory({ member: member3, group: group3 }).create();
            const registration4 = await new RegistrationFactory({ member: member4, group: group4 }).create();

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
            expect(response.body.results.registrations).toHaveLength(4);
            // Check ids are matching without depending on ordering using jest extended
            expect(response.body.results.registrations).toIncludeSameMembers([
                expect.objectContaining({ id: registration1.id }),
                expect.objectContaining({ id: registration2.id }),
                expect.objectContaining({ id: registration3.id }),
                expect.objectContaining({ id: registration4.id }),
            ]);
        });
    });

    describe('Financial data', () => {
        const balance = 123_450000;

        /**
         * Registers a member with an open balance, together with a user that can only read the
         * group that member is registered in, and that only carries the passed access rights.
         */
        async function setupRegistrationWithBalance(accessRights: AccessRight[]) {
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

            // The filters and sorters read the cached balance, not the balance items themselves
            await CachedBalance.updateForMembers(organization.id, [member.id]);
            await CachedBalance.updateForRegistrations(organization.id, [registration.id]);

            return { organization, group, member, registration, token };
        }

        async function fetchRegistrations({ organization, group, token, filter, sort }: { organization: Organization; group: Group; token: Token; filter?: StamhoofdFilter; sort?: SortList }) {
            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: filter ? { $and: [{ groupId: group.id }, filter] } : { groupId: group.id },
                    sort: sort ?? [{ key: 'id', order: SortItemDirection.ASC }],
                    limit: 10,
                }),
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });

            return await testServer.test(endpoint, request);
        }

        test('A user without MemberReadFinancialData cannot filter registrations on a balance', async () => {
            const { organization, group, token } = await setupRegistrationWithBalance([]);

            // Filtering is enough to read a balance: repeating the request narrows down the exact amount
            await expect(fetchRegistrations({ organization, group, token, filter: { memberCachedBalance: { amountOpen: { $gt: balance - 1 } } } })).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
            await expect(fetchRegistrations({ organization, group, token, filter: { registrationCachedBalance: { toPay: { $gt: balance - 1 } } } })).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
            await expect(fetchRegistrations({ organization, group, token, filter: { registrationCachedBalance: { price: { $gt: balance - 1 } } } })).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('A user without MemberReadFinancialData cannot sort registrations on a balance', async () => {
            const { organization, group, token } = await setupRegistrationWithBalance([]);

            // Sorting ranks every member by what they owe, without returning a single amount
            await expect(fetchRegistrations({ organization, group, token, sort: [{ key: 'memberCachedBalance.amountOpen', order: SortItemDirection.DESC }] })).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
            await expect(fetchRegistrations({ organization, group, token, sort: [{ key: 'registrationCachedBalance.toPay', order: SortItemDirection.DESC }] })).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
            await expect(fetchRegistrations({ organization, group, token, sort: [{ key: 'registrationCachedBalance.price', order: SortItemDirection.DESC }] })).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('A user with MemberReadFinancialData can filter and sort registrations on a balance', async () => {
            const { organization, group, registration, token } = await setupRegistrationWithBalance([AccessRight.MemberReadFinancialData]);

            const filtered = await fetchRegistrations({ organization, group, token, filter: { memberCachedBalance: { amountOpen: { $gt: balance - 1 } } } });
            expect(filtered.body.results.registrations.map(r => r.id)).toEqual([registration.id]);

            const sorted = await fetchRegistrations({ organization, group, token, sort: [{ key: 'memberCachedBalance.amountOpen', order: SortItemDirection.DESC }, { key: 'id', order: SortItemDirection.ASC }] });
            expect(sorted.body.results.registrations.map(r => r.id)).toEqual([registration.id]);
        });
    });

    describe('Sorting', () => {
        /**
         * Creates one event registration per passed price name, all in the same event group,
         * and returns an admin with full access to that organization.
         */
        async function setupEventRegistrations(priceNames: string[]) {
            const organization = await new OrganizationFactory({ period }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            }).create();

            const token = await SessionService.createSession(user);
            const group = await new GroupFactory({ organization, period, type: GroupType.EventRegistration }).create();

            group.settings.prices = [...new Set(priceNames)].map(name => GroupPrice.create({
                name: new TranslatedString(name),
            }));
            await group.save();

            const registrations: Registration[] = [];

            for (const priceName of priceNames) {
                const member = await new MemberFactory({}).create();
                const groupPrice = group.settings.prices.find(p => p.name.toString() === priceName)!;
                registrations.push(await new RegistrationFactory({ member, group, groupPrice }).create());
            }

            return { host: organization.getApiHost(), token, group, registrations };
        }

        /**
         * Requests every page by following the 'next' request the endpoint returns, exactly like the frontend does.
         * That next request is built from the sorter's getValue, so this covers the full sort + pagination flow:
         * getValue -> page filter -> encoded in the query -> decoded -> compiled back to SQL.
         *
         * Returns the ids of all registrations across all pages, in the order they were received.
         */
        async function fetchAllPages({ host, token, groupId, sort, limit }: { host: string; token: Token; groupId: string; sort: SortList; limit: number }) {
            const ids: string[] = [];
            let query: LimitedFilteredRequest | undefined = new LimitedFilteredRequest({ filter: { groupId }, sort, limit });
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

                ids.push(...response.body.results.registrations.map(r => r.id));
                query = response.body.next;
                pages += 1;

                if (pages > 10) {
                    throw new Error('Pagination did not terminate');
                }
            }

            return ids;
        }

        test('Registrations are sorted by group price ascending across all pages', async () => {
            // Deliberately not in alphabetical order, so a passing test cannot be explained by insertion order
            const { host, token, group, registrations } = await setupEventRegistrations(['Weekend', 'Dagtarief', 'Kampprijs', 'Broer of zus', 'Dagtarief']);
            const [weekend, day1, camp, sibling, day2] = registrations;

            // A limit lower than the total forces the endpoint to build a next page filter from getValue
            const ids = await fetchAllPages({
                host,
                token,
                groupId: group.id,
                sort: [{ key: 'groupPrice', order: SortItemDirection.ASC }],
                limit: 2,
            });

            expect(ids).toEqual([
                sibling.id,
                ...[day1.id, day2.id].sort(),
                camp.id,
                weekend.id,
            ]);
        });

        test('Registrations are sorted by group price descending across all pages', async () => {
            const { host, token, group, registrations } = await setupEventRegistrations(['Weekend', 'Dagtarief', 'Kampprijs', 'Broer of zus', 'Dagtarief']);
            const [weekend, day1, camp, sibling, day2] = registrations;

            const ids = await fetchAllPages({
                host,
                token,
                groupId: group.id,
                sort: [{ key: 'groupPrice', order: SortItemDirection.DESC }],
                limit: 2,
            });

            expect(ids).toEqual([
                weekend.id,
                camp.id,
                ...[day1.id, day2.id].sort().reverse(),
                sibling.id,
            ]);
        });

        test('Registrations are sorted by the group price name in the language of the request', async () => {
            const { host, token, group, registrations } = await setupEventRegistrations(['Beta', 'Mango', 'Zebra']);
            const [beta, mango, zebra] = registrations;

            // A translated name has to be sorted (and paginated) on the value the requester sees, not on another language
            const translated = new TranslatedString({ nl: 'Aap', en: 'Zulu' });
            group.settings.prices[2].name = translated;
            await group.save();

            zebra.groupPrice = zebra.groupPrice.patch({ name: translated });
            await zebra.save();

            const ids = await fetchAllPages({
                host,
                token,
                groupId: group.id,
                sort: [{ key: 'groupPrice', order: SortItemDirection.ASC }],
                limit: 1,
            });

            expect(ids).toEqual([
                zebra.id,
                beta.id,
                mango.id,
            ]);
        });

        test('Filtering on a group price id keeps working', async () => {
            const { host, token, group, registrations } = await setupEventRegistrations(['Weekend', 'Dagtarief', 'Kampprijs']);
            const [, dayRegistration] = registrations;

            const request = Request.get({
                path: baseUrl,
                host,
                query: new LimitedFilteredRequest({
                    filter: {
                        groupId: group.id,
                        groupPrice: {
                            id: {
                                $in: [dayRegistration.groupPrice.id],
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
            expect(response.body.results.registrations).toIncludeSameMembers([
                expect.objectContaining({ id: dayRegistration.id }),
            ]);
        });
    });
});
