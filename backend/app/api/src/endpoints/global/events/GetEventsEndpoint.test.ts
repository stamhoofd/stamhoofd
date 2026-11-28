import { Request } from '@stamhoofd/node-endpoints';
import { EventFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import {
    EventMeta,
    LimitedFilteredRequest,
    Permissions,
    PermissionsResourceKey,
    ResourcePermissions,
} from '@stamhoofd/structures';
import { AccessRight } from '@stamhoofd/types/AccessRight';
import { PermissionsResourceType } from '@stamhoofd/types/PermissionsResourceType';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetEventsEndpoint } from './GetEventsEndpoint.js';

const baseUrl = '/events';
const endpoint = new GetEventsEndpoint();

const eventWritePermissions = Permissions.create({
    resources: new Map([
        [
            PermissionsResourceType.Groups,
            new Map([
                [
                    PermissionsResourceKey.CurrentPeriod,
                    ResourcePermissions.create({
                        accessRights: [AccessRight.EventWrite],
                    }),
                ],
            ]),
        ],
    ]),
});

const nationalEventWritePermissions = Permissions.create({
    resources: new Map([
        [
            PermissionsResourceType.OrganizationTags,
            new Map([
                [
                    PermissionsResourceKey.All,
                    ResourcePermissions.create({
                        accessRights: [AccessRight.EventWrite],
                    }),
                ],
            ]),
        ],
    ]),
});

describe('Endpoint.GetEventsEndpoint', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    describe('Organization context', () => {
        test('A user without permissions does not receive the events that are hidden in the calendar', async () => {
            const organization = await new OrganizationFactory({}).create();
            const visibleEvent = await new EventFactory({ organization }).create();
            const hiddenEvent = await new EventFactory({
                organization,
                meta: EventMeta.create({ visible: false }),
            }).create();

            const user = await new UserFactory({}).create();
            const token = await SessionService.createSession(user);

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        id: { $in: [visibleEvent.id, hiddenEvent.id] },
                    },
                    limit: 100,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toEqual([
                expect.objectContaining({ id: visibleEvent.id }),
            ]);
        });

        test('An admin that can write events receives the events that are hidden in the calendar', async () => {
            const organization = await new OrganizationFactory({}).create();
            const visibleEvent = await new EventFactory({ organization }).create();
            const hiddenEvent = await new EventFactory({
                organization,
                meta: EventMeta.create({ visible: false }),
            }).create();

            const user = await new UserFactory({
                organization,
                permissions: eventWritePermissions,
            }).create();
            const token = await SessionService.createSession(user);

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        id: { $in: [visibleEvent.id, hiddenEvent.id] },
                    },
                    limit: 100,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toIncludeSameMembers([
                expect.objectContaining({ id: visibleEvent.id }),
                expect.objectContaining({ id: hiddenEvent.id }),
            ]);
        });

        test('A user without permissions does not receive the hidden events of other organizations', async () => {
            const organization = await new OrganizationFactory({}).create();
            const otherOrganization = await new OrganizationFactory({}).create();
            const hiddenEvent = await new EventFactory({
                organization: otherOrganization,
                meta: EventMeta.create({ visible: false }),
            }).create();

            const user = await new UserFactory({}).create();
            const token = await SessionService.createSession(user);

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: {
                        id: { $in: [hiddenEvent.id] },
                    },
                    limit: 100,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(0);
        });
    });

    describe('Platform context', () => {
        test('A user without permissions does not receive the hidden events of an organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const visibleEvent = await new EventFactory({ organization }).create();
            const hiddenEvent = await new EventFactory({
                organization,
                meta: EventMeta.create({ visible: false }),
            }).create();

            const user = await new UserFactory({}).create();
            const token = await SessionService.createSession(user);

            const request = Request.get({
                path: baseUrl,
                host: 'platform.stamhoofd.app',
                query: new LimitedFilteredRequest({
                    filter: {
                        id: { $in: [visibleEvent.id, hiddenEvent.id] },
                    },
                    limit: 100,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toEqual([
                expect.objectContaining({ id: visibleEvent.id }),
            ]);
        });

        test('A user without permissions does not receive the hidden national events', async () => {
            const visibleEvent = await new EventFactory({}).create();
            const hiddenEvent = await new EventFactory({
                meta: EventMeta.create({ visible: false }),
            }).create();

            const user = await new UserFactory({}).create();
            const token = await SessionService.createSession(user);

            const request = Request.get({
                path: baseUrl,
                host: 'platform.stamhoofd.app',
                query: new LimitedFilteredRequest({
                    filter: {
                        id: { $in: [visibleEvent.id, hiddenEvent.id] },
                    },
                    limit: 100,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toEqual([
                expect.objectContaining({ id: visibleEvent.id }),
            ]);
        });

        test('A platform admin that can write national events receives the hidden national events', async () => {
            const visibleEvent = await new EventFactory({}).create();
            const hiddenEvent = await new EventFactory({
                meta: EventMeta.create({ visible: false }),
            }).create();

            const user = await new UserFactory({
                globalPermissions: nationalEventWritePermissions,
            }).create();
            const token = await SessionService.createSession(user);

            const request = Request.get({
                path: baseUrl,
                host: 'platform.stamhoofd.app',
                query: new LimitedFilteredRequest({
                    filter: {
                        id: { $in: [visibleEvent.id, hiddenEvent.id] },
                    },
                    limit: 100,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toIncludeSameMembers([
                expect.objectContaining({ id: visibleEvent.id }),
                expect.objectContaining({ id: hiddenEvent.id }),
            ]);
        });
    });
});
