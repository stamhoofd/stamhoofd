import { PatchableArray } from '@simonbackx/simple-encoding';
import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { EventFactory, Organization, OrganizationFactory, PlatformEventTypeFactory, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { AccessRight, Event, Permissions, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer';
import { PatchEventsEndpoint } from './PatchEventsEndpoint';

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
                organizationId: organization.id,
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
