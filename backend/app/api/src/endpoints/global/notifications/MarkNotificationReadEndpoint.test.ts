import { Request } from '@simonbackx/simple-endpoints';
import type { User } from '@stamhoofd/models';
import { UserFactory } from '@stamhoofd/models';
import { Notification } from '@stamhoofd/models/models/Notification.js';
import { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import { NamedObject } from '@stamhoofd/structures';
import { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import type { UserNotification } from '@stamhoofd/structures/notifications/UserNotification.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { NotificationService } from '../../../services/NotificationService.js';
import { SessionService } from '../../../services/SessionService.js';
import { MarkNotificationReadEndpoint } from './MarkNotificationReadEndpoint.js';

describe('Endpoint.MarkNotificationReadEndpoint', () => {
    const endpoint = new MarkNotificationReadEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(async () => {
        await Notification.delete();
    });

    async function post(user: User | null, id: string) {
        const request = Request.post({
            path: '/notifications/' + id + '/read',
            headers: user ? { authorization: 'Bearer ' + (await SessionService.createSession(user)).accessToken } : {},
        });
        return await testServer.test<UserNotification>(endpoint, request);
    }

    async function sendGrouped(users: User[], resourceId: string) {
        return (await NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: {},
            group: { key: 'registrations', resource: NamedObject.create({ id: resourceId, name: resourceId }) },
            to: { users },
        }))!;
    }

    test('marks only the given notification of the user as read', async () => {
        const user = await new UserFactory({}).create();
        const other = await new UserFactory({}).create();

        const notification = await sendGrouped([user, other], '1');
        await sendGrouped([user, other], '2');
        const unrelated = (await NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: {},
            to: { users: [user] },
        }))!;

        const recipient = await NotificationRecipient.select()
            .where('notificationId', notification.id)
            .andWhere('userId', user.id)
            .first(true);

        const response = await post(user, recipient.id);
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(recipient.id);
        expect(response.body.notificationId).toBe(notification.id);
        expect(response.body.readAt).not.toBeNull();
        expect(response.body.readCount).toBe(2);

        const otherRecipient = await NotificationRecipient.select()
            .where('notificationId', notification.id)
            .andWhere('userId', other.id)
            .first(true);
        expect(otherRecipient.readAt).toBeNull();

        const unrelatedRecipient = await NotificationRecipient.select()
            .where('notificationId', unrelated.id)
            .first(true);
        expect(unrelatedRecipient.readAt).toBeNull();
    });

    test('keeps the original read date of a fully read notification, but marks new grouped items as read', async () => {
        const user = await new UserFactory({}).create();
        const notification = await sendGrouped([user], '1');

        const recipient = await NotificationRecipient.select().where('notificationId', notification.id).first(true);
        const readAt = new Date(2026, 0, 1);
        recipient.readAt = readAt;
        recipient.readCount = 1;
        await recipient.save();

        expect((await post(user, recipient.id)).body.readAt).toEqual(readAt);

        await sendGrouped([user], '2');
        const response = await post(user, recipient.id);
        expect(response.body.readAt).not.toEqual(readAt);
        expect(response.body.readCount).toBe(2);
    });

    test('cannot mark a notification of another user', async () => {
        const user = await new UserFactory({}).create();
        const other = await new UserFactory({}).create();

        const notification = await sendGrouped([other], '1');
        const recipient = await NotificationRecipient.select().where('notificationId', notification.id).first(true);

        await expect(post(user, recipient.id)).rejects.toThrow(STExpect.simpleError({ code: 'not_found' }));
        await expect(post(user, 'unknown-id')).rejects.toThrow(STExpect.simpleError({ code: 'not_found' }));

        const reloaded = await NotificationRecipient.getByID(recipient.id);
        expect(reloaded!.readAt).toBeNull();
    });

    test('requires authentication', async () => {
        await expect(post(null, 'id')).rejects.toThrow(STExpect.simpleError({ code: 'not_authenticated' }));
    });
});
