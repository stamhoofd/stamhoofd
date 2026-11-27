import { Request } from '@node/endpoints';
import {
    EventFactory,
    EventNotificationFactory,
    OrganizationFactory,
    UserFactory,
} from '@stamhoofd/models';
import {
    CountFilteredRequest,
    LimitedFilteredRequest,
    Permissions,
    PermissionsResourceKey,
    ResourcePermissions,
} from '@stamhoofd/structures';
import { AccessRight } from '@stamhoofd/types/AccessRight';
import { PermissionsResourceType } from '@stamhoofd/types/PermissionsResourceType';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetEventNotificationsCountEndpoint } from './GetEventNotificationsCountEndpoint.js';
import { GetEventNotificationsEndpoint } from './GetEventNotificationsEndpoint.js';

const baseUrl = '/event-notifications';
const endpoint = new GetEventNotificationsEndpoint();
const countEndpoint = new GetEventNotificationsCountEndpoint();

const reviewerPermissions = Permissions.create({
    resources: new Map([
        [
            PermissionsResourceType.OrganizationTags,
            new Map([
                [
                    PermissionsResourceKey.All,
                    ResourcePermissions.create({
                        accessRights: [AccessRight.OrganizationEventNotificationReviewer],
                    }),
                ],
            ]),
        ],
    ]),
});

describe('Endpoint.GetEventNotificationsEndpoint', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    describe('Organization context', () => {
        test('A user without permissions cannot count the event notifications of an organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            await new EventNotificationFactory({ organization }).create();

            const user = await new UserFactory({}).create();
            const token = await SessionService.createSession(user);

            const request = Request.get({
                path: baseUrl + '/count',
                host: organization.getApiHost(),
                query: new CountFilteredRequest({}),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            await expect(testServer.test(countEndpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('A user without permissions cannot use the count filters to probe which events have a notification', async () => {
            const organization = await new OrganizationFactory({}).create();
            const event = await new EventFactory({ organization }).create();
            await new EventNotificationFactory({ organization, events: [event] }).create();

            const user = await new UserFactory({}).create();
            const token = await SessionService.createSession(user);

            const request = Request.get({
                path: baseUrl + '/count',
                host: organization.getApiHost(),
                query: new CountFilteredRequest({
                    filter: {
                        events: {
                            $elemMatch: {
                                id: event.id,
                            },
                        },
                    },
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            await expect(testServer.test(countEndpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('A user without permissions cannot list the event notifications of an organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            await new EventNotificationFactory({ organization }).create();

            const user = await new UserFactory({}).create();
            const token = await SessionService.createSession(user);

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ limit: 100 }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('A reviewer can count and list the event notifications of the organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const notification = await new EventNotificationFactory({ organization }).create();

            const user = await new UserFactory({ globalPermissions: reviewerPermissions }).create();
            const token = await SessionService.createSession(user);

            const countRequest = Request.get({
                path: baseUrl + '/count',
                host: organization.getApiHost(),
                query: new CountFilteredRequest({}),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const countResponse = await testServer.test(countEndpoint, countRequest);
            expect(countResponse.status).toBe(200);
            expect(countResponse.body.count).toBe(1);

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ limit: 100 }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toEqual([
                expect.objectContaining({ id: notification.id }),
            ]);
        });
    });
});
