import { PatchableArray } from '@simonbackx/simple-encoding';
import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { EventFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriodFactory, PlatformEventTypeFactory, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { AccessRight, Event, Group, GroupSettings, GroupType, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, TranslatedString } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { PatchEventsEndpoint } from './PatchEventsEndpoint.js';

const baseUrl = `/events`;
const endpoint = new PatchEventsEndpoint();
type EndpointType = typeof endpoint;
type Body = EndpointType extends Endpoint<any, any, infer B, any> ? B : never;

const minimumUserPermissions = Permissions.create({
    resources: new Map([
        [PermissionsResourceType.Groups, new Map([
            ['', ResourcePermissions.create({
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
            const token = await Token.createToken(options.user);
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
                        ['', ResourcePermissions.create({
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
            }).create();

            const body: Body = new PatchableArray();
            const newEvent = Event.patch({
                id: event.id,
                group: Group.create({
                    settings: GroupSettings.create({
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
            }).create();

            const body: Body = new PatchableArray();
            const newEvent = Event.patch({
                id: event.id,
                group: Group.create({
                    settings: GroupSettings.create({
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
            }).create();

            const body: Body = new PatchableArray();
            const newEvent = Event.patch({
                id: event.id,
                group: Group.create({
                    settings: GroupSettings.create({
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
            }).create();

            async function part1() {
                const body: Body = new PatchableArray();
                const newEvent = Event.patch({
                    id: event.id,
                    group: Group.create({
                        settings: GroupSettings.create({
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

        test('A normal user with write access can create an event where the type has a maximum', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                organization,
                permissions: minimumUserPermissions,
            }).create();

            const startDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
            const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            // create registration period
            await new RegistrationPeriodFactory({
                startDate,
                endDate,
                organization,
            }).create();

            const body: Body = new PatchableArray();
            const newEvent = Event.create({
                organizationId: organization.id,
                typeId: (await new PlatformEventTypeFactory({
                    maximum: 5,
                }).create()).id,
                name: 'test event',
                startDate,
                endDate,
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
    });
});
