import { Database } from '@simonbackx/simple-database';
import { PatchableArray } from '@simonbackx/simple-encoding';
import type { Endpoint } from '@simonbackx/simple-endpoints';
import { Request } from '@simonbackx/simple-endpoints';
import type { User } from '@stamhoofd/models';
import { Event as EventModel, EventFactory, Group as GroupModel, GroupFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriodFactory, Platform, PlatformEventTypeFactory, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { AccessRight, Event, EventMeta, Group, GroupSettings, GroupType, NamedObject, OrganizationEventType, PermissionLevel, Permissions, PermissionsResourceKey, PermissionsResourceType, ResourcePermissions, TranslatedString } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { PatchEventsEndpoint } from './PatchEventsEndpoint.js';
import { SessionService } from '../../../services/SessionService.js';

const baseUrl = `/events`;
const endpoint = new PatchEventsEndpoint();
type EndpointType = typeof endpoint;
type Body = EndpointType extends Endpoint<any, any, infer B, any> ? B : never;

const minimumUserPermissions = Permissions.create({
    resources: new Map([
        [PermissionsResourceType.Groups, new Map([
            [PermissionsResourceKey.CurrentPeriod, ResourcePermissions.create({
                accessRights: [AccessRight.EventWrite],
            })],
        ])],
    ]),
});

const TestRequest = {
    async patch(options: {
        body?: Body;
        user?: User;
        organization?: Organization;
    }) {
        const request = Request.buildJson('PATCH', baseUrl, options.organization?.getApiHost(), options.body);
        if (options.user) {
            const token = await SessionService.createSession(options.user);
            request.headers.authorization = 'Bearer ' + token.accessToken;
        }
        return await testServer.test(endpoint, request);
    },
};

describe('Endpoint.PatchEventsEndpoint', () => {
    let admin: User;

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'platform');

        admin = await new UserFactory({
            globalPermissions: Permissions.create({
                resources: new Map([
                    [PermissionsResourceType.OrganizationTags, new Map([
                        [PermissionsResourceKey.All, ResourcePermissions.create({
                            accessRights: [
                                AccessRight.EventWrite,
                            ],
                        })],
                    ])],
                ]),
            }),
        }).create();
    });

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('A normal user with write access can create an event', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();

        const body: Body = new PatchableArray();
        const newEvent = Event.create({
            organizationId: organization.id,
            typeId: (await new PlatformEventTypeFactory({}).create()).id,
            name: 'test event',
            startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        body.addPut(newEvent);

        const result = await TestRequest.patch({ body, user, organization });
        expect(result.status).toBe(200);
        expect(result.body).toHaveLength(1);
        expect(result.body[0]).toMatchObject({
            organizationId: newEvent.organizationId,
            typeId: newEvent.typeId,
            name: newEvent.name,
        });
    });

    test('A user with only write access to events can create an event with or without groups they cannot access', async () => {
        const period = await new RegistrationPeriodFactory({
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }).create();
        const organization = await new OrganizationFactory({ period }).create();
        const group = await new GroupFactory({ organization, period }).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                resources: new Map([
                    [PermissionsResourceType.Events, new Map([
                        [PermissionsResourceKey.CurrentPeriod, ResourcePermissions.create({
                            level: PermissionLevel.Write,
                        })],
                    ])],
                ]),
            }),
        }).create();
        const typeId = (await new PlatformEventTypeFactory({}).create()).id;

        const withoutGroups = Event.create({
            organizationId: organization.id,
            typeId,
            name: 'without groups',
            startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        const withGroups = Event.create({
            organizationId: organization.id,
            typeId,
            name: 'with groups',
            startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            meta: EventMeta.create({
                groups: [NamedObject.create({ id: group.id, name: group.settings.name.toString() })],
            }),
        });

        const body: Body = new PatchableArray();
        body.addPut(withoutGroups);
        body.addPut(withGroups);

        const result = await TestRequest.patch({ body, user, organization });
        expect(result.status).toBe(200);
        expect(result.body).toHaveLength(2);
        expect(result.body.find(e => e.id === withoutGroups.id)?.meta.groups).toBeNull();
        expect(result.body.find(e => e.id === withGroups.id)?.meta.groups?.map(g => g.id)).toEqual([group.id]);
    });

    test('A user with write access to events of the current period cannot create an event outside that period', async () => {
        const period = await new RegistrationPeriodFactory({
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }).create();
        const organization = await new OrganizationFactory({ period }).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                resources: new Map([
                    [PermissionsResourceType.Events, new Map([
                        [PermissionsResourceKey.CurrentPeriod, ResourcePermissions.create({
                            level: PermissionLevel.Write,
                        })],
                    ])],
                ]),
            }),
        }).create();

        const body: Body = new PatchableArray();
        body.addPut(Event.create({
            organizationId: organization.id,
            typeId: (await new PlatformEventTypeFactory({}).create()).id,
            name: 'outside period',
            startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 61 * 24 * 60 * 60 * 1000),
        }));

        await expect(TestRequest.patch({ body, user, organization }))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('Write access to a deleted event does not allow creating a new event with the same id', async () => {
        const organization = await new OrganizationFactory({}).create();
        const deletedEvent = await new EventFactory({ organization }).create();
        await deletedEvent.delete();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                resources: new Map([
                    [PermissionsResourceType.Events, new Map([
                        [deletedEvent.id, ResourcePermissions.create({
                            level: PermissionLevel.Write,
                        })],
                    ])],
                ]),
            }),
        }).create();

        const body: Body = new PatchableArray();
        body.addPut(Event.create({
            id: deletedEvent.id,
            organizationId: organization.id,
            typeId: (await new PlatformEventTypeFactory({}).create()).id,
            name: 'test event',
            startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }));

        await expect(TestRequest.patch({ body, user, organization }))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('A user with event write access for one group can only create events for that group', async () => {
        const organization = await new OrganizationFactory({}).create();
        const group = await new GroupFactory({ organization }).create();
        const otherGroup = await new GroupFactory({ organization }).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                resources: new Map([
                    [PermissionsResourceType.Groups, new Map([
                        [group.id, ResourcePermissions.create({
                            accessRights: [AccessRight.EventWrite],
                        })],
                    ])],
                ]),
            }),
        }).create();
        const typeId = (await new PlatformEventTypeFactory({}).create()).id;

        const createEvent = (groups: GroupModel[] | null) => {
            const body: Body = new PatchableArray();
            body.addPut(Event.create({
                organizationId: organization.id,
                typeId,
                name: 'test event',
                startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                meta: EventMeta.create({
                    groups: groups?.map(g => NamedObject.create({ id: g.id, name: g.settings.name.toString() })) ?? null,
                }),
            }));
            return TestRequest.patch({ body, user, organization });
        };

        const result = await createEvent([group]);
        expect(result.status).toBe(200);
        expect(result.body[0].meta.groups?.map(g => g.id)).toEqual([group.id]);

        await expect(createEvent(null))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));

        await expect(createEvent([otherGroup]))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));

        await expect(createEvent([group, otherGroup]))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));
    });

    describe('hasFutureEvents recomputation', () => {
        // A global event (organizationId === null) counts towards every organization,
        // so make sure leftover events from other tests don't influence these assertions.
        beforeEach(async () => {
            await Database.delete('DELETE FROM `events`');
        });

        test('Creating a future event sets hasFutureEvents to true on the organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            organization.hasFutureEvents = false;
            await organization.save();

            const user = await new UserFactory({
                organization,
                permissions: minimumUserPermissions,
            }).create();

            const body: Body = new PatchableArray();
            body.addPut(Event.create({
                organizationId: organization.id,
                typeId: (await new PlatformEventTypeFactory({}).create()).id,
                name: 'test event',
                startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            }));

            const result = await TestRequest.patch({ body, user, organization });
            expect(result.status).toBe(200);

            const updated = await Organization.getByID(organization.id, true);
            expect(updated.hasFutureEvents).toBe(true);
        });

        test('Creating an event that already ended does not set hasFutureEvents to true', async () => {
            const organization = await new OrganizationFactory({}).create();
            organization.hasFutureEvents = false;
            await organization.save();

            const user = await new UserFactory({
                organization,
                permissions: minimumUserPermissions,
            }).create();

            const body: Body = new PatchableArray();
            // Ended well before the future-events cutoff (~2 months ago), so it should not count.
            body.addPut(Event.create({
                organizationId: organization.id,
                typeId: (await new PlatformEventTypeFactory({}).create()).id,
                name: 'test event',
                startDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            }));

            const result = await TestRequest.patch({ body, user, organization });
            expect(result.status).toBe(200);

            const updated = await Organization.getByID(organization.id, true);
            expect(updated.hasFutureEvents).toBe(false);
        });
    });

    test('A normal user with write access cannot create a global event', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();

        const body: Body = new PatchableArray();
        const newEvent = Event.create({
            organizationId: null,
            typeId: (await new PlatformEventTypeFactory({}).create()).id,
            name: 'test event',
            startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        body.addPut(newEvent);

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });

    test('A normal user with write access cannot make an event global', async () => {
        const organization = await new OrganizationFactory({}).create();

        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();

        const startDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const body: Body = new PatchableArray();

        const eventToPatch = await new EventFactory({
            organization,
            typeId: (await new PlatformEventTypeFactory({
                maximum: 5,
            }).create()).id,
            name: 'test event',
            startDate,
            endDate,

        }).create();

        body.addPatch(Event.patch({
            id: eventToPatch.id,
            organizationId: null,
        }));

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });

    test('An admin can create a global event', async () => {
        const organization = await new OrganizationFactory({}).create();

        const body: Body = new PatchableArray();
        const newEvent = Event.create({
            organizationId: null,
            typeId: (await new PlatformEventTypeFactory({}).create()).id,
            name: 'test event',
            startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        body.addPut(newEvent);

        const result = await TestRequest.patch({ body, user: admin, organization });
        expect(result.status).toBe(200);
        expect(result.body).toHaveLength(1);
        expect(result.body[0]).toMatchObject({
            organizationId: newEvent.organizationId,
            typeId: newEvent.typeId,
            name: newEvent.name,
        });
    });

    test('A platform user with only write access to events of the current period can create a global event in that period', async () => {
        const platform = await Platform.getForEditing();
        const originalPeriodId = platform.periodId;
        const period = await new RegistrationPeriodFactory({
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }).create();
        platform.periodId = period.id;
        await platform.save();

        try {
            const user = await new UserFactory({
                globalPermissions: Permissions.create({
                    resources: new Map([
                        [PermissionsResourceType.Events, new Map([
                            [PermissionsResourceKey.CurrentPeriod, ResourcePermissions.create({
                                level: PermissionLevel.Write,
                            })],
                        ])],
                    ]),
                }),
            }).create();
            const typeId = (await new PlatformEventTypeFactory({}).create()).id;

            const createEvent = (startDate: Date) => {
                const body: Body = new PatchableArray();
                body.addPut(Event.create({
                    organizationId: null,
                    typeId,
                    name: 'global event',
                    startDate,
                    endDate: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000),
                }));
                return TestRequest.patch({ body, user });
            };

            const result = await createEvent(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
            expect(result.status).toBe(200);
            expect(result.body[0].organizationId).toBeNull();
            expect(result.body[0].meta.organizationTagIds).toBeNull();

            await expect(createEvent(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)))
                .rejects
                .toThrow(STExpect.errorWithCode('permission_denied'));
        } finally {
            platform.periodId = originalPeriodId;
            await platform.save();
        }
    });

    // userMode platform: the period is resolved from the event start date without looking at the
    // organization, so it can land in a period this organization never started.
    test('Cannot create a group for an event in a platform period the organization has not started', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const startedPeriod = await new RegistrationPeriodFactory({
            startDate: new Date('2000-01-01'),
            endDate: new Date('2001-01-01'),
        }).create();

        await new OrganizationRegistrationPeriodFactory({
            period: startedPeriod,
            organization,
        }).create();

        organization.periodId = startedPeriod.id;
        await organization.save();

        await new RegistrationPeriodFactory({
            startDate: new Date('2001-01-01'),
            endDate: new Date('2002-01-01'),
        }).create();

        const event = await new EventFactory({
            organization,
            name: 'test event',
            startDate: new Date('2001-02-10'),
            endDate: new Date('2001-02-12'),
            typeId: (await new PlatformEventTypeFactory({}).create()).id,
        }).create();

        const body: Body = new PatchableArray();
        body.addPatch(Event.patch({
            id: event.id,
            group: Group.create({
                settings: GroupSettings.create({
                    name: TranslatedString.create('Naam'),
                }),
            }),
        }));

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(STExpect.simpleError({
            code: 'missing_organization_period',
        }));

        const updatedEvent = await EventModel.getByID(event.id);
        expect(updatedEvent!.groupId).toBeNull();
    });

    describe('userMode organization', () => {
        beforeEach(async () => {
            TestUtils.setEnvironment('userMode', 'organization');
        });

        test('Cannot create group for event in non-default period as non-full admin', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: minimumUserPermissions,
            }).create();

            const period1 = await new RegistrationPeriodFactory({
                startDate: new Date('2000-01-01'),
                endDate: new Date('2001-01-01'),
                organization,
            }).create();

            await new OrganizationRegistrationPeriodFactory({
                period: period1,
                organization,
            }).create();

            const period2 = await new RegistrationPeriodFactory({
                startDate: new Date('2001-01-01'),
                endDate: new Date('2002-01-01'),
                organization,
            }).create();

            await new OrganizationRegistrationPeriodFactory({
                period: period2,
                organization,
            }).create();

            organization.periodId = period2.id;
            await organization.save();

            const event = await new EventFactory({
                organization,
                name: 'test event',
                startDate: new Date('2000-02-10'),
                endDate: new Date('2000-02-12'),
                typeId: OrganizationEventType.DEFAULT_ID,
            }).create();

            const body: Body = new PatchableArray();
            const newEvent = Event.patch({
                id: event.id,
                group: Group.create({
                    settings: GroupSettings.create({
                        name: TranslatedString.create('Naam'),
                        description: TranslatedString.create('Inschrijvingsgroep'),
                    }),
                }),
            });
            body.addPatch(newEvent);

            await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(STExpect.simpleError({
                code: 'permission_denied',
            }));
        });

        test('Can create group for event in non-default period as full admin', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const period1 = await new RegistrationPeriodFactory({
                startDate: new Date('2000-01-01'),
                endDate: new Date('2001-01-01'),
                organization,
            }).create();

            await new OrganizationRegistrationPeriodFactory({
                period: period1,
                organization,
            }).create();

            const period2 = await new RegistrationPeriodFactory({
                startDate: new Date('2001-01-01'),
                endDate: new Date('2002-01-01'),
                organization,
            }).create();

            await new OrganizationRegistrationPeriodFactory({
                period: period2,
                organization,
            }).create();

            organization.periodId = period2.id;
            await organization.save();

            const event = await new EventFactory({
                organization,
                name: 'test event',
                startDate: new Date('2000-02-10'),
                endDate: new Date('2000-02-12'),
                typeId: OrganizationEventType.DEFAULT_ID,
            }).create();

            const body: Body = new PatchableArray();
            const newEvent = Event.patch({
                id: event.id,
                group: Group.create({
                    settings: GroupSettings.create({
                        name: TranslatedString.create('Naam'),
                        description: TranslatedString.create('Inschrijvingsgroep'),
                    }),
                }),
            });
            body.addPatch(newEvent);

            const result = await TestRequest.patch({ body, user, organization });
            expect(result.status).toBe(200);
            expect(result.body).toHaveLength(1);
            expect(result.body[0].group).toBeDefined();
            expect(result.body[0].group!.settings.name).toEqual(TranslatedString.create('test event'));
            expect(result.body[0].group!.settings.description).toEqual(TranslatedString.create('Inschrijvingsgroep'));
            expect(result.body[0].group!.periodId).toEqual(period1.id);
            expect(result.body[0].group!.organizationId).toEqual(organization.id);
            expect(result.body[0].group!.type).toEqual(GroupType.EventRegistration);
        });

        test('Can create group for event in default period as non-full admin', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: minimumUserPermissions,
            }).create();

            const period1 = await new RegistrationPeriodFactory({
                startDate: new Date('2000-01-01'),
                endDate: new Date('2001-01-01'),
                organization,
            }).create();

            await new OrganizationRegistrationPeriodFactory({
                period: period1,
                organization,
            }).create();

            const period2 = await new RegistrationPeriodFactory({
                startDate: new Date('2001-01-01'),
                endDate: new Date('2002-01-01'),
                organization,
            }).create();

            await new OrganizationRegistrationPeriodFactory({
                period: period2,
                organization,
            }).create();

            organization.periodId = period2.id;
            await organization.save();

            const event = await new EventFactory({
                organization,
                name: 'test event',
                startDate: new Date('2001-02-10'),
                endDate: new Date('2001-02-12'),
                typeId: OrganizationEventType.DEFAULT_ID,
            }).create();

            const body: Body = new PatchableArray();
            const newEvent = Event.patch({
                id: event.id,
                group: Group.create({
                    settings: GroupSettings.create({
                        name: TranslatedString.create('Naam'),
                        description: TranslatedString.create('Inschrijvingsgroep'),
                    }),
                }),
            });
            body.addPatch(newEvent);

            const result = await TestRequest.patch({ body, user, organization });
            expect(result.status).toBe(200);
            expect(result.body).toHaveLength(1);
            expect(result.body[0].group).toBeDefined();
            expect(result.body[0].group!.settings.name).toEqual(TranslatedString.create('test event'));
            expect(result.body[0].group!.settings.description).toEqual(TranslatedString.create('Inschrijvingsgroep'));
            expect(result.body[0].group!.periodId).toEqual(period2.id);
            expect(result.body[0].group!.organizationId).toEqual(organization.id);
            expect(result.body[0].group!.type).toEqual(GroupType.EventRegistration);
        });

        test('Changing an event startDate will move the registration period of the corresponding group', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }), // full permissions are required, otherwise you'll get a permission error
            }).create();

            const period1 = await new RegistrationPeriodFactory({
                startDate: new Date('2000-01-01'),
                endDate: new Date('2001-01-01'),
                organization,
            }).create();

            await new OrganizationRegistrationPeriodFactory({
                period: period1,
                organization,
            }).create();

            const period2 = await new RegistrationPeriodFactory({
                startDate: new Date('2001-01-01'),
                endDate: new Date('2002-01-01'),
                organization,
            }).create();

            await new OrganizationRegistrationPeriodFactory({
                period: period2,
                organization,
            }).create();

            const event = await new EventFactory({
                organization,
                name: 'test event',
                startDate: new Date('2000-02-10'),
                endDate: new Date('2000-02-12'),
                typeId: OrganizationEventType.DEFAULT_ID,
            }).create();

            async function part1() {
                const body: Body = new PatchableArray();
                const newEvent = Event.patch({
                    id: event.id,
                    group: Group.create({
                        settings: GroupSettings.create({
                            name: TranslatedString.create('Naam'),
                            description: TranslatedString.create('Inschrijvingsgroep'),
                        }),
                    }),
                });
                body.addPatch(newEvent);

                const result = await TestRequest.patch({ body, user, organization });
                expect(result.status).toBe(200);
                expect(result.body).toHaveLength(1);
                expect(result.body[0].group).toBeDefined();
                expect(result.body[0].group!.settings.name).toEqual(TranslatedString.create('test event'));
                expect(result.body[0].group!.settings.description).toEqual(TranslatedString.create('Inschrijvingsgroep'));
                expect(result.body[0].group!.periodId).toEqual(period1.id);
                expect(result.body[0].group!.organizationId).toEqual(organization.id);
                expect(result.body[0].group!.type).toEqual(GroupType.EventRegistration);
            }
            await part1();

            // Now alter start date
            async function part2() {
                const body: Body = new PatchableArray();
                const newEvent = Event.patch({
                    id: event.id,
                    startDate: new Date('2001-02-10'),
                    endDate: new Date('2001-02-12'),
                });
                body.addPatch(newEvent);

                const result = await TestRequest.patch({ body, user, organization });
                expect(result.status).toBe(200);
                expect(result.body).toHaveLength(1);
                expect(result.body[0].group).toBeDefined();
                expect(result.body[0].group!.periodId).toEqual(period2.id);
            }
            await part2();
        });

        test('Cannot create a group for an event in a period the organization has not started', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const period1 = await new RegistrationPeriodFactory({
                startDate: new Date('2000-01-01'),
                endDate: new Date('2001-01-01'),
                organization,
            }).create();

            // No OrganizationRegistrationPeriod for period1: the organization never started it

            const period2 = await new RegistrationPeriodFactory({
                startDate: new Date('2001-01-01'),
                endDate: new Date('2002-01-01'),
                organization,
            }).create();

            await new OrganizationRegistrationPeriodFactory({
                period: period2,
                organization,
            }).create();

            organization.periodId = period2.id;
            await organization.save();

            const event = await new EventFactory({
                organization,
                name: 'test event',
                startDate: new Date('2000-02-10'),
                endDate: new Date('2000-02-12'),
                typeId: OrganizationEventType.DEFAULT_ID,
            }).create();

            const body: Body = new PatchableArray();
            body.addPatch(Event.patch({
                id: event.id,
                group: Group.create({
                    settings: GroupSettings.create({
                        name: TranslatedString.create('Naam'),
                    }),
                }),
            }));

            await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(STExpect.simpleError({
                code: 'missing_organization_period',
            }));

            const updatedEvent = await EventModel.getByID(event.id);
            expect(updatedEvent!.groupId).toBeNull();
        });

        test('Cannot move an event to a period the organization has not started', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const period1 = await new RegistrationPeriodFactory({
                startDate: new Date('2000-01-01'),
                endDate: new Date('2001-01-01'),
                organization,
            }).create();

            await new OrganizationRegistrationPeriodFactory({
                period: period1,
                organization,
            }).create();

            const period2 = await new RegistrationPeriodFactory({
                startDate: new Date('2001-01-01'),
                endDate: new Date('2002-01-01'),
                organization,
            }).create();

            // No OrganizationRegistrationPeriod for period2: the organization never started it

            organization.periodId = period1.id;
            await organization.save();

            const event = await new EventFactory({
                organization,
                name: 'test event',
                startDate: new Date('2000-02-10'),
                endDate: new Date('2000-02-12'),
                typeId: OrganizationEventType.DEFAULT_ID,
            }).create();

            const createBody: Body = new PatchableArray();
            createBody.addPatch(Event.patch({
                id: event.id,
                group: Group.create({
                    settings: GroupSettings.create({
                        name: TranslatedString.create('Naam'),
                    }),
                }),
            }));

            const created = await TestRequest.patch({ body: createBody, user, organization });
            expect(created.body[0].group!.periodId).toEqual(period1.id);

            const moveBody: Body = new PatchableArray();
            moveBody.addPatch(Event.patch({
                id: event.id,
                startDate: new Date('2001-02-10'),
                endDate: new Date('2001-02-12'),
            }));

            await expect(TestRequest.patch({ body: moveBody, user, organization })).rejects.toThrow(STExpect.simpleError({
                code: 'missing_organization_period',
                field: 'startDate',
            }));

            const group = await GroupModel.getByID(created.body[0].group!.id);
            expect(group!.periodId).toEqual(period1.id);

            // The event is only saved after its group moved along, so the new dates are not stored
            const updatedEvent = await EventModel.getByID(event.id);
            expect(updatedEvent!.startDate).toEqual(new Date('2000-02-10'));
        });

        test('Cannot move an event with registrations to a date without a period', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const period = await new RegistrationPeriodFactory({
                startDate: new Date('2000-01-01'),
                endDate: new Date('2001-01-01'),
                organization,
            }).create();

            await new OrganizationRegistrationPeriodFactory({
                period,
                organization,
            }).create();

            organization.periodId = period.id;
            await organization.save();

            const event = await new EventFactory({
                organization,
                name: 'test event',
                startDate: new Date('2000-02-10'),
                endDate: new Date('2000-02-12'),
                typeId: OrganizationEventType.DEFAULT_ID,
            }).create();

            const createBody: Body = new PatchableArray();
            createBody.addPatch(Event.patch({
                id: event.id,
                group: Group.create({
                    settings: GroupSettings.create({
                        name: TranslatedString.create('Naam'),
                    }),
                }),
            }));

            const created = await TestRequest.patch({ body: createBody, user, organization });
            expect(created.body[0].group!.periodId).toEqual(period.id);

            // No registration period covers 2005
            const moveBody: Body = new PatchableArray();
            moveBody.addPatch(Event.patch({
                id: event.id,
                startDate: new Date('2005-02-10'),
                endDate: new Date('2005-02-12'),
            }));

            await expect(TestRequest.patch({ body: moveBody, user, organization })).rejects.toThrow(STExpect.simpleError({
                code: 'invalid_period',
                field: 'startDate',
            }));

            const group = await GroupModel.getByID(created.body[0].group!.id);
            expect(group!.periodId).toEqual(period.id);

            const updatedEvent = await EventModel.getByID(event.id);
            expect(updatedEvent!.startDate).toEqual(new Date('2000-02-10'));
        });

        test('A normal user with write access cannot create a global event', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: minimumUserPermissions,
            }).create();

            const body: Body = new PatchableArray();
            const newEvent = Event.create({
                organizationId: null,
                typeId: OrganizationEventType.DEFAULT_ID,
                name: 'test event',
                startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            });
            body.addPut(newEvent);

            await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
                STExpect.simpleError({ code: 'permission_denied' }),
            );
        });

        test('A normal user with write access cannot make an event global', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                organization,
                permissions: minimumUserPermissions,
            }).create();

            const startDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
            const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            const body: Body = new PatchableArray();

            const eventToPatch = await new EventFactory({
                organization,
                typeId: (await new PlatformEventTypeFactory({
                    maximum: 5,
                }).create()).id,
                name: 'test event',
                startDate,
                endDate,

            }).create();

            body.addPatch(Event.patch({
                id: eventToPatch.id,
                organizationId: null,
            }));

            await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
                STExpect.simpleError({ code: 'permission_denied' }),
            );
        });
    });
});
