import { PatchableArray, PatchMap, patchObject } from '@simonbackx/simple-encoding';
import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import { EmailTemplateFactory, EventFactory, EventNotification, EventNotificationFactory, EventNotificationTypeFactory, Organization, OrganizationFactory, Platform, RecordAnswerFactory, RecordCategoryFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { AccessRight, BaseOrganization, EmailTemplateType, Event, EventNotificationStatus, EventNotification as EventNotificationStruct, Permissions, PermissionsResourceType, RecordType, ResourcePermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { PatchEventNotificationsEndpoint } from './PatchEventNotificationsEndpoint.js';

const baseUrl = `/event-notifications`;
const endpoint = new PatchEventNotificationsEndpoint();
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
    let admin: User;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        await new EmailTemplateFactory({
            type: EmailTemplateType.EventNotificationAccepted,
        }).create();

        await new EmailTemplateFactory({
            type: EmailTemplateType.EventNotificationPartiallyAccepted,
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

        // Create an admin that will receive the emails
        admin = await new UserFactory({
            email: 'event-notification-reviewer@example.com',
            globalPermissions: Permissions.create({
                resources: new Map([
                    [PermissionsResourceType.OrganizationTags, new Map([
                        ['', ResourcePermissions.create({
                            accessRights: [
                                AccessRight.OrganizationEventNotificationReviewer,
                            ],
                        })],
                    ])],
                ]),
            }),
        }).create();
    });

    test('A normal user can create new event notifications for an event', async () => {
        const startDate = new Date(2024, 8, 1, 0, 0, 0, 0);
        const endDate = new Date(2025, 7, 31, 0, 0, 0, 0);
        const registrationPeriod = await new RegistrationPeriodFactory({ startDate, endDate }).create();
        const organization = await new OrganizationFactory({}).create();
        registrationPeriod.organizationId = organization.id;
        await registrationPeriod.save();

        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization, startDate, endDate }).create();
        const recordCategories = await new RecordCategoryFactory({
            records: [
                {
                    type: RecordType.Checkbox,
                },
                {
                    type: RecordType.Text,
                    required: true,
                },
            ],
        }).createMultiple(2);
        const notificationType = (await new EventNotificationTypeFactory({ recordCategories }).create());

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
            STExpect.simpleError({ code: 'invalid_field', field: 'typeId' }),
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
            STExpect.simpleError({ code: 'invalid_field', field: 'events' }),
        );
    });

    test('It throws when trying to create an event notification for a locked period', async () => {
        // Clear all periods and organizations (to make sure the right locked period is used)
        const platform = await Platform.getForEditing();
        await platform.delete();
        await Organization.delete();
        await RegistrationPeriod.delete();

        await new RegistrationPeriodFactory({
            startDate: new Date(2050, 0, 1),
            endDate: new Date(2051, 11, 31),
            locked: true,
        }).create();
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({
            organization,
            startDate: new Date(2050, 10, 1),
            endDate: new Date(2051, 10, 15),
        }).create();
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
            STExpect.simpleError({ code: 'invalid_period', field: 'startDate' }),
        );
    });

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
            STExpect.simpleError({ code: 'invalid_field', field: 'events' }),
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

        expect(await EmailMocker.transactional.getSucceededEmails()).toIncludeSameMembers([
            expect.objectContaining({
                to: 'event-notification-reviewer@example.com',
                subject: EmailTemplateType.EventNotificationSubmittedReviewer,
                text: expect.stringContaining(event.name),
            }),

            expect.objectContaining({
                to: user.email,
                subject: EmailTemplateType.EventNotificationSubmittedCopy,
                text: expect.stringContaining(event.name),
            }),
        ]);
    });

    test('A normal user can move the event notification to pending state from rejected', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Rejected,
        }).create();

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

        expect(await EmailMocker.transactional.getSucceededEmails()).toIncludeSameMembers([
            expect.objectContaining({
                to: 'event-notification-reviewer@example.com',
                subject: EmailTemplateType.EventNotificationSubmittedReviewer,
                text: expect.stringContaining(event.name),
            }),

            expect.objectContaining({
                to: user.email,
                subject: EmailTemplateType.EventNotificationSubmittedCopy,
                text: expect.stringContaining(event.name),
            }),
        ]);
    });

    test('A normal user can move the event notification to pending state from partially accepted', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.PartiallyAccepted,
        }).create();

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

        expect(await EmailMocker.transactional.getSucceededEmails()).toIncludeSameMembers([
            expect.objectContaining({
                to: 'event-notification-reviewer@example.com',
                subject: EmailTemplateType.EventNotificationSubmittedReviewer,
                text: expect.stringContaining(event.name),
            }),

            expect.objectContaining({
                to: user.email,
                subject: EmailTemplateType.EventNotificationSubmittedCopy,
                text: expect.stringContaining(event.name),
            }),
        ]);
    });

    test('A normal user cannot move the event notification to pending from accepted', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Accepted,
        }).create();

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                status: EventNotificationStatus.Pending,
            }),
        );

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });

    test('A normal user cannot move the event notification to accepted from pending', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Pending,
        }).create();

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                status: EventNotificationStatus.Accepted,
            }),
        );

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });

    test('A normal user cannot move the event notification to accepted from draft', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Draft,
        }).create();

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                status: EventNotificationStatus.Accepted,
            }),
        );

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });

    test('A normal user cannot move the event notification to partially accepted from draft', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Draft,
        }).create();

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                status: EventNotificationStatus.PartiallyAccepted,
            }),
        );

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });

    test('A normal user cannot edit an accepted event notification', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Accepted,
        }).create();

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                recordAnswers: new PatchMap(),
            }),
        );

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });

    test('A normal user can edit an partially accepted event notification', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();

        const recordCategories = await new RecordCategoryFactory({
            records: [
                {
                    type: RecordType.Checkbox,
                },
                {
                    type: RecordType.Text,
                    required: true,
                },
            ],
        }).createMultiple(2);

        const firstRecord = recordCategories[0].records[0];

        const notificationType = (await new EventNotificationTypeFactory({ recordCategories }).create());
        const acceptedRecordAnswers = await new RecordAnswerFactory({ recordCategories }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.PartiallyAccepted,
            typeId: notificationType.id,
            acceptedRecordAnswers: acceptedRecordAnswers,
            recordAnswers: acceptedRecordAnswers,
        }).create();

        const patchedRecordAnswers = await new RecordAnswerFactory({ records: [firstRecord] }).create();
        const patch = new PatchMap([...patchedRecordAnswers.entries()]);

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                recordAnswers: patch,
            }),
        );

        const result = await TestRequest.patch({ body, user, organization });
        expect(result.status).toBe(200);
        expect(result.body).toHaveLength(1);

        expect(result.body[0]).toMatchObject({
            status: EventNotificationStatus.PartiallyAccepted,
            acceptedRecordAnswers: expect.toMatchMap(acceptedRecordAnswers),
            recordAnswers: expect.toMatchMap(
                patchObject(acceptedRecordAnswers, patch),
            ),
        });
    });

    test('A normal user cannot edit a pending event notification', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Pending,
        }).create();

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                recordAnswers: new PatchMap(),
            }),
        );

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });

    test('An admin can accept an event notification', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();

        const recordCategories = await new RecordCategoryFactory({
            records: [
                {
                    type: RecordType.Checkbox,
                },
                {
                    type: RecordType.Text,
                    required: true,
                },
            ],
        }).createMultiple(2);

        const notificationType = (await new EventNotificationTypeFactory({ recordCategories }).create());
        const acceptedRecordAnswers = await new RecordAnswerFactory({ recordCategories }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Pending,
            typeId: notificationType.id,
            recordAnswers: acceptedRecordAnswers,
            submittedBy: user,
        }).create();

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                status: EventNotificationStatus.Accepted,
            }),
        );

        const result = await TestRequest.patch({ body, user: admin, organization });
        expect(result.status).toBe(200);
        expect(result.body).toHaveLength(1);

        expect(result.body[0]).toMatchObject({
            status: EventNotificationStatus.Accepted,
            acceptedRecordAnswers: expect.toMatchMap(acceptedRecordAnswers),
            recordAnswers: expect.toMatchMap(acceptedRecordAnswers),
        });

        // Check mails
        expect(await EmailMocker.transactional.getSucceededEmails()).toIncludeSameMembers([
            expect.objectContaining({
                to: user.email,
                subject: EmailTemplateType.EventNotificationAccepted,
                text: expect.stringContaining(event.name),
            }),
        ]);
    });

    test('An admin can partially accept an event notification and set feedback', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();

        const recordCategories = await new RecordCategoryFactory({
            records: [
                {
                    type: RecordType.Checkbox,
                },
                {
                    type: RecordType.Text,
                    required: true,
                },
            ],
        }).createMultiple(2);

        const notificationType = (await new EventNotificationTypeFactory({ recordCategories }).create());
        const acceptedRecordAnswers = await new RecordAnswerFactory({ recordCategories }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Pending,
            typeId: notificationType.id,
            recordAnswers: acceptedRecordAnswers,
            submittedBy: user,
        }).create();

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                status: EventNotificationStatus.PartiallyAccepted,
                feedbackText: 'Some feedback',
            }),
        );

        const result = await TestRequest.patch({ body, user: admin, organization });
        expect(result.status).toBe(200);
        expect(result.body).toHaveLength(1);

        expect(result.body[0]).toMatchObject({
            status: EventNotificationStatus.PartiallyAccepted,
            feedbackText: 'Some feedback',
            acceptedRecordAnswers: expect.toMatchMap(acceptedRecordAnswers),
            recordAnswers: expect.toMatchMap(acceptedRecordAnswers),
        });

        // Check mails
        expect(await EmailMocker.transactional.getSucceededEmails()).toIncludeSameMembers([
            expect.objectContaining({
                to: user.email,
                subject: EmailTemplateType.EventNotificationPartiallyAccepted,
                text: expect.stringContaining(event.name),
                html: expect.stringContaining('Some feedback'),
            }),
        ]);
    });

    test('An admin can reject an event notification with feedback', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();

        const recordCategories = await new RecordCategoryFactory({
            records: [
                {
                    type: RecordType.Checkbox,
                },
                {
                    type: RecordType.Text,
                    required: true,
                },
            ],
        }).createMultiple(2);

        const notificationType = (await new EventNotificationTypeFactory({ recordCategories }).create());
        const acceptedRecordAnswers = await new RecordAnswerFactory({ recordCategories }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Pending,
            typeId: notificationType.id,
            recordAnswers: acceptedRecordAnswers,
            submittedBy: user,
        }).create();

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                status: EventNotificationStatus.Rejected,
                feedbackText: 'Some feedback',
            }),
        );

        const result = await TestRequest.patch({ body, user: admin, organization });
        expect(result.status).toBe(200);
        expect(result.body).toHaveLength(1);

        expect(result.body[0]).toMatchObject({
            status: EventNotificationStatus.Rejected,
            feedbackText: 'Some feedback',
            acceptedRecordAnswers: expect.toMatchMap(new Map()),
            recordAnswers: expect.toMatchMap(acceptedRecordAnswers),
        });

        // Check mails
        expect(await EmailMocker.transactional.getSucceededEmails()).toIncludeSameMembers([
            expect.objectContaining({
                to: user.email,
                subject: EmailTemplateType.EventNotificationRejected,
                text: expect.stringContaining(event.name),
                html: expect.stringContaining('Some feedback'),
            }),
        ]);
    });

    test('An admin can move an event notification back to draft', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();

        const recordCategories = await new RecordCategoryFactory({
            records: [
                {
                    type: RecordType.Checkbox,
                },
                {
                    type: RecordType.Text,
                    required: true,
                },
            ],
        }).createMultiple(2);

        const notificationType = (await new EventNotificationTypeFactory({ recordCategories }).create());
        const acceptedRecordAnswers = await new RecordAnswerFactory({ recordCategories }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Accepted,
            typeId: notificationType.id,
            recordAnswers: acceptedRecordAnswers,
            submittedBy: user,
        }).create();

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                status: EventNotificationStatus.Draft,
            }),
        );

        const result = await TestRequest.patch({ body, user: admin, organization });
        expect(result.status).toBe(200);
        expect(result.body).toHaveLength(1);

        expect(result.body[0]).toMatchObject({
            status: EventNotificationStatus.Draft,
            acceptedRecordAnswers: expect.toMatchMap(new Map()),
            recordAnswers: expect.toMatchMap(acceptedRecordAnswers),
        });

        // Check mails
        expect(await EmailMocker.transactional.getSucceededEmails()).toIncludeSameMembers([]);
    });

    test('An admin can edit an accepted event notification', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();

        const recordCategories = await new RecordCategoryFactory({
            records: [
                {
                    type: RecordType.Checkbox,
                },
                {
                    type: RecordType.Text,
                    required: true,
                },
            ],
        }).createMultiple(2);

        const notificationType = (await new EventNotificationTypeFactory({ recordCategories }).create());
        const acceptedRecordAnswers = await new RecordAnswerFactory({ recordCategories }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Accepted,
            typeId: notificationType.id,
            recordAnswers: acceptedRecordAnswers,
            acceptedRecordAnswers: acceptedRecordAnswers,
            submittedBy: user,
        }).create();

        const patchedRecordAnswers = await new RecordAnswerFactory({ records: [recordCategories[0].records[0]] }).create();
        const patch = new PatchMap([...patchedRecordAnswers.entries()]);

        const body: Body = new PatchableArray();
        body.addPatch(
            EventNotificationStruct.patch({
                id: eventNotification.id,
                recordAnswers: patch,
            }),
        );

        const result = await TestRequest.patch({ body, user: admin, organization });
        expect(result.status).toBe(200);
        expect(result.body).toHaveLength(1);

        expect(result.body[0]).toMatchObject({
            status: EventNotificationStatus.Accepted,

            // Note: the record answers should automatically copy over to the accepted record answers
            acceptedRecordAnswers: expect.toMatchMap(
                patchObject(acceptedRecordAnswers, patch),
            ),
            recordAnswers: expect.toMatchMap(
                patchObject(acceptedRecordAnswers, patch),
            ),
        });

        // Check mails
        expect(await EmailMocker.transactional.getSucceededEmails()).toIncludeSameMembers([]);
    });

    test('An admin can delete an event notification', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();

        const recordCategories = await new RecordCategoryFactory({
            records: [
                {
                    type: RecordType.Checkbox,
                },
                {
                    type: RecordType.Text,
                    required: true,
                },
            ],
        }).createMultiple(2);

        const notificationType = (await new EventNotificationTypeFactory({ recordCategories }).create());
        const acceptedRecordAnswers = await new RecordAnswerFactory({ recordCategories }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Accepted,
            typeId: notificationType.id,
            recordAnswers: acceptedRecordAnswers,
            submittedBy: user,
        }).create();

        const body: Body = new PatchableArray();
        body.addDelete(
            eventNotification.id,
        );

        const result = await TestRequest.patch({ body, user: admin, organization });
        expect(result.status).toBe(200);
        expect(result.body).toHaveLength(0);

        // Check mails
        expect(await EmailMocker.transactional.getSucceededEmails()).toIncludeSameMembers([]);

        // Check not exists
        const model = await EventNotification.getByID(eventNotification.id);
        expect(model).toBeUndefined();
    });

    test('An user cannot delete an event notification', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: minimumUserPermissions,
        }).create();
        const event = await new EventFactory({ organization }).create();

        const recordCategories = await new RecordCategoryFactory({
            records: [
                {
                    type: RecordType.Checkbox,
                },
                {
                    type: RecordType.Text,
                    required: true,
                },
            ],
        }).createMultiple(2);

        const notificationType = (await new EventNotificationTypeFactory({ recordCategories }).create());
        const acceptedRecordAnswers = await new RecordAnswerFactory({ recordCategories }).create();
        const eventNotification = await new EventNotificationFactory({
            organization,
            events: [event],
            status: EventNotificationStatus.Accepted,
            typeId: notificationType.id,
            recordAnswers: acceptedRecordAnswers,
            submittedBy: user,
        }).create();

        const body: Body = new PatchableArray();
        body.addDelete(
            eventNotification.id,
        );

        await expect(TestRequest.patch({ body, user, organization })).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });
});
