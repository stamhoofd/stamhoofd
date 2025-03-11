import { PatchableArray } from '@simonbackx/simple-encoding';
import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { EventNotificationFactory, EventFactory, EventNotificationTypeFactory, Organization, OrganizationFactory, Token, User, UserFactory, EmailTemplateFactory } from '@stamhoofd/models';
import { AccessRight, BaseOrganization, EmailTemplateType, Event, EventNotificationStatus, EventNotification as EventNotificationStruct, Permissions, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { PatchEventNotificationsEndpoint } from './PatchEventNotificationsEndpoint';
import { testServer } from '../../../../tests/helpers/TestServer';
import { EmailMocker } from '@stamhoofd/email';

const baseUrl = `/event-notifications`;
const endpoint = new PatchEventNotificationsEndpoint();
type EndpointType = typeof endpoint;
type Body = EndpointType extends Endpoint<any, any, infer B, any> ? B : never;

const errorWithCode = (code: string) => expect.objectContaining({ code }) as jest.Constructable;
const errorWithMessage = (message: string) => expect.objectContaining({ message }) as jest.Constructable;
const simpleError = (data: {
    code?: string;
    message?: string;
    field?: string;
}) => {
    return expect.objectContaining({
        code: data.code ?? expect.any(String),
        message: data.message ?? expect.any(String),
        field: data.field ?? expect.anything(),
    }) as jest.Constructable;
};

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
        body?: any;
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

describe('Endpoint.PatchEventNotificationsEndpoint', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        await new EmailTemplateFactory({
            type: EmailTemplateType.EventNotificationAccepted,
        }).create();

        await new EmailTemplateFactory({
            type: EmailTemplateType.EventNotificationPartiallyAcceptedEdited,
        }).create();

        await new EmailTemplateFactory({
            type: EmailTemplateType.EventNotificationRejected,
        }).create();

        await new EmailTemplateFactory({
            type: EmailTemplateType.EventNotificationSubmittedCopy,
        }).create();

        await new EmailTemplateFactory({
            type: EmailTemplateType.EventNotificationSubmittedReviewer,
        }).create();
    });

    test('A normal user can create new event notifications for an event', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();
        const notificationType = (await new EventNotificationTypeFactory({ }).create());

        const body: Body = new PatchableArray();
        body.addPut(
            EventNotificationStruct.create({
                typeId: notificationType.id,
                events: [Event.create({ id: event.id })],
                organization: BaseOrganization.create({
                    id: organization.id,
                }),
                status: EventNotificationStatus.Draft,
            }),
        );

        const result = await TestRequest.patch({ body, user, organization });
        expect(result.status).toBe(200);

        expect(result.body).toHaveLength(1);
        expect(result.body[0]).toMatchObject({
            typeId: notificationType.id,
            events: [expect.objectContaining({ id: event.id })],
            organization: expect.objectContaining({ id: organization.id }),
            status: EventNotificationStatus.Draft,
            createdBy: expect.objectContaining({ id: user.id }),
            submittedBy: null,
        });
    });

    test('It throws when trying to create an event notification for an invalid event notification type id', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();

        const body: Body = new PatchableArray();
        body.addPut(
            EventNotificationStruct.create({
                typeId: 'invalid',
                events: [Event.create({ id: event.id })],
                organization: BaseOrganization.create({
                    id: organization.id,
                }),
                status: EventNotificationStatus.Draft,
            }),
        );

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            simpleError({ code: 'invalid_field', field: 'typeId' }),
        );
    });

    test('It throws when trying to create an event notification for an invalid event', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const notificationType = (await new EventNotificationTypeFactory({ }).create());

        const body: Body = new PatchableArray();
        body.addPut(
            EventNotificationStruct.create({
                typeId: notificationType.id,
                events: [Event.create({ id: 'invalid' })],
                organization: BaseOrganization.create({
                    id: organization.id,
                }),
                status: EventNotificationStatus.Draft,
            }),
        );

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            simpleError({ code: 'invalid_field', field: 'events' }),
        );
    });
    test.todo('It throws when trying to create an event notification for a locked period');

    test('It throws when trying to create an event notification for an event in a different organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const otherOrganization = await new OrganizationFactory({}).create();

        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization: otherOrganization }).create();
        const notificationType = (await new EventNotificationTypeFactory({ }).create());

        const body: Body = new PatchableArray();
        body.addPut(
            EventNotificationStruct.create({
                typeId: notificationType.id,
                events: [Event.create({ id: event.id })],
                organization: BaseOrganization.create({
                    id: organization.id,
                }),
                status: EventNotificationStatus.Draft,
            }),
        );

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            simpleError({ code: 'invalid_field', field: 'events' }),
        );
    });

    test('A normal user can move the event notification to pending state from draft', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();
        const eventNotification = await new EventNotificationFactory({ organization, events: [event] }).create();

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                status: EventNotificationStatus.Pending,
            }),
        );

        const result = await TestRequest.patch({ body, user, organization });
        expect(result.status).toBe(200);

        expect(result.body).toHaveLength(1);
        expect(result.body[0]).toMatchObject({
            organization: expect.objectContaining({ id: organization.id }),
            status: EventNotificationStatus.Pending,
            submittedBy: expect.objectContaining({ id: user.id }),
        });

        expect(EmailMocker.transactional.getSucceededEmails()).toIncludeSameMembers([
            expect.objectContaining({
                to: user.email,
                text: expect.stringContaining(event.name),
            }),
        ]);
    });

    test.todo('A normal user can move the event notification to pending state from rejected');
    test.todo('A normal user cannot move the event notification to pending from accepted');

    test.todo('A normal user cannot edit an accepted event notification');
    test.todo('A normal user cannot edit a pending event notification');

    test.todo('An admin can accept an event notification');
    test.todo('An admin can partially accept an event notification');
    test.todo('An admin can reject an event notification');
    test.todo('An admin can move an event notification back to draft');
});
