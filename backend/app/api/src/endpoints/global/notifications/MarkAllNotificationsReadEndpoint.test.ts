import { Request } from '@simonbackx/simple-endpoints';
import type { User } from '@stamhoofd/models';
import { UserFactory } from '@stamhoofd/models';
import { Notification } from '@stamhoofd/models/models/Notification.js';
import { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import { NamedObject } from '@stamhoofd/structures';
import type { CountResponse } from '@stamhoofd/structures';
import { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { NotificationService } from '../../../services/NotificationService.js';
import { SessionService } from '../../../services/SessionService.js';
import { MarkAllNotificationsReadEndpoint } from './MarkAllNotificationsReadEndpoint.js';

describe('Endpoint.MarkAllNotificationsReadEndpoint', () => {
    const endpoint = new MarkAllNotificationsReadEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(async () => {
        await Notification.delete();
    });

    async function post(user: User | null) {
        const request = Request.post({
            path: '/notifications/mark-all-read',
            headers: user ? { authorization: 'Bearer ' + (await SessionService.createSession(user)).accessToken } : {},
        });
        return await testServer.test<CountResponse>(endpoint, request);
    }

    test('marks all unread notifications of the user as read with the current group count', async () => {
        const user = await new UserFactory({}).create();
        const other = await new UserFactory({}).create();

        const grouped = (await NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: {},
            group: { key: 'registrations', resource: NamedObject.create({ id: '1', name: '1' }) },
            to: { users: [user, other] },
        }))!;
        await NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: {},
            group: { key: 'registrations', resource: NamedObject.create({ id: '2', name: '2' }) },
            to: { users: [user, other] },
        });
        const single = (await NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: {},
            to: { users: [user] },
        }))!;

        const seenAt = new Date(2026, 0, 1);
        const seenRecipient = await NotificationRecipient.select().where('notificationId', single.id).first(true);
        seenRecipient.seenAt = seenAt;
        await seenRecipient.save();

        const alreadyRead = (await NotificationService.send({
            type: NotificationType.RegistrationCreated,
            payload: {},
            to: { users: [user] },
        }))!;
        await NotificationService.markAsRead(await NotificationRecipient.select().where('notificationId', alreadyRead.id).first(true));

        const response = await post(user);
        expect(response.status).toBe(200);
        expect(response.body.count).toBe(2);

        const recipients = await NotificationRecipient.select().where('userId', user.id).fetch();
        expect(recipients).toHaveLength(3);
        expect(recipients.every(r => r.readAt !== null && r.seenAt !== null)).toBe(true);
        expect(recipients.find(r => r.notificationId === grouped.id)!.readCount).toBe(2);
        expect(recipients.find(r => r.notificationId === single.id)!.seenAt).toEqual(seenAt);

        const otherRecipients = await NotificationRecipient.select().where('userId', other.id).fetch();
        expect(otherRecipients.every(r => r.readAt === null)).toBe(true);

        expect((await post(user)).body.count).toBe(0);
    });

    test('requires authentication', async () => {
        await expect(post(null)).rejects.toThrow(STExpect.simpleError({ code: 'not_authenticated' }));
    });
});
