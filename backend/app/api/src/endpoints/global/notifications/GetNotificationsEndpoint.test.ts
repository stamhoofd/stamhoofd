import { Request } from '@simonbackx/simple-endpoints';
import type { User } from '@stamhoofd/models';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { Notification } from '@stamhoofd/models/models/Notification.js';
import type { PaginatedResponse, StamhoofdFilter } from '@stamhoofd/structures';
import { LimitedFilteredRequest, SortItemDirection } from '@stamhoofd/structures';
import { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import type { UserNotification } from '@stamhoofd/structures/notifications/UserNotification.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { NotificationService } from '../../../services/NotificationService.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetNotificationsEndpoint } from './GetNotificationsEndpoint.js';

describe('Endpoint.GetNotificationsEndpoint', () => {
    const endpoint = new GetNotificationsEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(async () => {
        await Notification.delete();
    });

    async function get(user: User | null, query: Partial<ConstructorParameters<typeof LimitedFilteredRequest>[0]> = {}) {
        const request = Request.get({
            path: '/notifications',
            query: new LimitedFilteredRequest({ limit: 10, ...query }),
            headers: user ? { authorization: 'Bearer ' + (await SessionService.createSession(user)).accessToken } : {},
        });
        return await testServer.test<PaginatedResponse<UserNotification[], LimitedFilteredRequest>>(endpoint, request);
    }

    async function send(users: User[], options: { organizationId?: string; type?: NotificationType } = {}) {
        return (await NotificationService.send({
            type: options.type ?? NotificationType.RegistrationCreated,
            payload: { n: users.length },
            organizationId: options.organizationId,
            to: { users },
        }))!;
    }

    test('returns only the notifications of the authenticated user, newest first', async () => {
        const user = await new UserFactory({}).create();
        const other = await new UserFactory({}).create();

        const first = await send([user, other]);
        await send([other]);
        const third = await send([user]);

        const response = await get(user);
        expect(response.status).toBe(200);
        expect(response.body.results.map(r => r.notificationId)).toEqual([third.id, first.id]);
        expect(response.body.results[0]).toMatchObject({
            type: NotificationType.RegistrationCreated,
            payload: { n: 1 },
            readAt: null,
            readCount: 0,
            groupResourceCount: 0,
        });
        expect(response.body.next).toBeUndefined();
    });

    test('paginates with the next request', async () => {
        const user = await new UserFactory({}).create();
        const ids: string[] = [];
        for (let i = 0; i < 5; i++) {
            ids.push((await send([user])).id);
        }

        const page1 = await get(user, { limit: 2 });
        expect(page1.body.results.map(r => r.notificationId)).toEqual([ids[4], ids[3]]);
        expect(page1.body.next).toBeDefined();

        const page2 = await get(user, page1.body.next!);
        expect(page2.body.results.map(r => r.notificationId)).toEqual([ids[2], ids[1]]);

        const page3 = await get(user, page2.body.next!);
        expect(page3.body.results.map(r => r.notificationId)).toEqual([ids[0]]);
        expect(page3.body.next).toBeUndefined();
    });

    test('supports filters on notification and recipient columns', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({}).create();

        const inOrganization = await send([user], { organizationId: organization.id });
        await send([user]);

        const byOrganization = await get(user, { filter: { organizationId: organization.id } });
        expect(byOrganization.body.results.map(r => r.notificationId)).toEqual([inOrganization.id]);

        const unread = await get(user, { filter: { readAt: null } });
        expect(unread.body.results).toHaveLength(2);

        const read = await get(user, { filter: { readAt: { $neq: null } } as StamhoofdFilter });
        expect(read.body.results).toHaveLength(0);

        const byType = await get(user, { filter: { type: 'something.else' } });
        expect(byType.body.results).toHaveLength(0);
    });

    test('only allows sorting by id descending', async () => {
        const user = await new UserFactory({}).create();
        await send([user]);

        const explicit = await get(user, { sort: [{ key: 'id', order: SortItemDirection.DESC }] });
        expect(explicit.body.results).toHaveLength(1);

        await expect(get(user, { sort: [{ key: 'id', order: SortItemDirection.ASC }] })).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'sort' }));
        await expect(get(user, { sort: [{ key: 'createdAt', order: SortItemDirection.DESC }] })).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'sort' }));
    });

    test('validates the limit and requires authentication', async () => {
        const user = await new UserFactory({}).create();

        await expect(get(user, { limit: 101 })).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'limit' }));
        await expect(get(user, { limit: 0 })).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'limit' }));
        await expect(get(null)).rejects.toThrow(STExpect.simpleError({ code: 'not_authenticated' }));
    });

    test('does not support search', async () => {
        const user = await new UserFactory({}).create();
        await expect(get(user, { search: 'x' })).rejects.toThrow(STExpect.simpleError({ code: 'not_supported' }));
    });
});
