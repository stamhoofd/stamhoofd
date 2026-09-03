import { Request } from '@simonbackx/simple-endpoints';
import type { User } from '@stamhoofd/models';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { Notification } from '@stamhoofd/models/models/Notification.js';
import { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import type { CountResponse, StamhoofdFilter } from '@stamhoofd/structures';
import { CountFilteredRequest } from '@stamhoofd/structures';
import { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { NotificationService } from '../../../services/NotificationService.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetUnreadNotificationsCountEndpoint } from './GetUnreadNotificationsCountEndpoint.js';

describe('Endpoint.GetUnreadNotificationsCountEndpoint', () => {
    const endpoint = new GetUnreadNotificationsCountEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(async () => {
        await Notification.delete();
    });

    async function count(user: User, filter: StamhoofdFilter | null = null) {
        const request = Request.get({
            path: '/notifications/unread-count',
            query: new CountFilteredRequest({ filter }),
            headers: { authorization: 'Bearer ' + (await SessionService.createSession(user)).accessToken },
        });
        return (await testServer.test<CountResponse>(endpoint, request)).body.count;
    }

    async function send(users: User[], organizationId?: string) {
        return (await NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: {},
            organizationId,
            to: { users },
        }))!;
    }

    test('counts unread, not dismissed notifications of the user', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({}).create();
        const other = await new UserFactory({}).create();

        await send([user], organization.id);
        await send([user, other]);
        const read = await send([user]);
        const dismissed = await send([user]);
        await send([other]);

        await NotificationService.markAsRead(await NotificationRecipient.select().where('notificationId', read.id).first(true));

        const dismissedRecipient = await NotificationRecipient.select().where('notificationId', dismissed.id).first(true);
        dismissedRecipient.dismissedAt = new Date();
        await dismissedRecipient.save();

        expect(await count(user)).toBe(2);
        expect(await count(other)).toBe(2);
        expect(await count(user, { organizationId: organization.id })).toBe(1);
    });
});
