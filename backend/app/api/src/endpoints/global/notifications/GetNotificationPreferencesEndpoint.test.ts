import { Request } from '@simonbackx/simple-endpoints';
import type { User } from '@stamhoofd/models';
import { UserFactory } from '@stamhoofd/models';
import { NotificationPreference as NotificationPreferenceModel } from '@stamhoofd/models/models/NotificationPreference.js';
import { NotificationChannel } from '@stamhoofd/structures/notifications/NotificationChannel.js';
import type { NotificationPreference } from '@stamhoofd/structures/notifications/NotificationPreference.js';
import { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetNotificationPreferencesEndpoint } from './GetNotificationPreferencesEndpoint.js';

describe('Endpoint.GetNotificationPreferencesEndpoint', () => {
    const endpoint = new GetNotificationPreferencesEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(async () => {
        await NotificationPreferenceModel.delete();
    });

    async function get(user: User | null) {
        const request = Request.get({
            path: '/notifications/preferences',
            headers: user ? { authorization: 'Bearer ' + (await SessionService.createSession(user)).accessToken } : {},
        });
        return await testServer.test<NotificationPreference[]>(endpoint, request);
    }

    async function store(user: User, channel: NotificationChannel, enabled: boolean) {
        const preference = new NotificationPreferenceModel();
        preference.userId = user.id;
        preference.notificationType = NotificationType.RegistrationCreated;
        preference.channel = channel;
        preference.enabled = enabled;
        await preference.save();
    }

    test('returns only the stored preferences of the authenticated user', async () => {
        const user = await new UserFactory({}).create();
        const other = await new UserFactory({}).create();

        expect((await get(user)).body).toEqual([]);

        await store(user, NotificationChannel.InApp, false);
        await store(user, NotificationChannel.Push, true);
        await store(other, NotificationChannel.Push, false);

        const response = await get(user);
        expect(response.status).toBe(200);
        expect(response.body.map(p => ({ type: p.type, channel: p.channel, enabled: p.enabled })).sort((a, b) => a.channel.localeCompare(b.channel))).toEqual([
            { type: NotificationType.RegistrationCreated, channel: NotificationChannel.InApp, enabled: false },
            { type: NotificationType.RegistrationCreated, channel: NotificationChannel.Push, enabled: true },
        ]);
    });

    test('requires authentication', async () => {
        await expect(get(null)).rejects.toThrow(STExpect.simpleError({ code: 'not_authenticated' }));
    });
});
