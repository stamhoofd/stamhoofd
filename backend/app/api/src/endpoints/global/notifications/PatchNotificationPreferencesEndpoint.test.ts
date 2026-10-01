import { Request } from '@simonbackx/simple-endpoints';
import type { User } from '@stamhoofd/models';
import { UserFactory } from '@stamhoofd/models';
import { NotificationPreference as NotificationPreferenceModel } from '@stamhoofd/models/models/NotificationPreference.js';
import { Version } from '@stamhoofd/structures';
import { NotificationChannel } from '@stamhoofd/structures/notifications/NotificationChannel.js';
import { NotificationPreference } from '@stamhoofd/structures/notifications/NotificationPreference.js';
import { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { PatchNotificationPreferencesEndpoint } from './PatchNotificationPreferencesEndpoint.js';

type PreferenceData = { type: string; channel: string; enabled: boolean };

describe('Endpoint.PatchNotificationPreferencesEndpoint', () => {
    const endpoint = new PatchNotificationPreferencesEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(async () => {
        await NotificationPreferenceModel.delete();
    });

    async function patch(user: User | null, preferences: PreferenceData[]) {
        const request = Request.patch({
            path: '/notifications/preferences',
            body: JSON.stringify(preferences.map(p => NotificationPreference.create(p as NotificationPreference).encode({ version: Version }))),
            headers: user ? { authorization: 'Bearer ' + (await SessionService.createSession(user)).accessToken } : {},
        });
        return await testServer.test<NotificationPreference[]>(endpoint, request);
    }

    function sorted(preferences: PreferenceData[]) {
        return preferences.map(p => ({ type: p.type, channel: p.channel, enabled: p.enabled })).sort((a, b) => a.channel.localeCompare(b.channel));
    }

    async function stored(user: User) {
        const models = await NotificationPreferenceModel.select().where('userId', user.id).fetch();
        return sorted(models.map(m => ({ type: m.notificationType, channel: m.channel, enabled: m.enabled })));
    }

    test('stores preferences per user and channel, and an update keeps the other channels', async () => {
        const user = await new UserFactory({}).create();
        const other = await new UserFactory({}).create();

        const first = await patch(user, [
            { type: NotificationType.RegistrationCreated, channel: NotificationChannel.InApp, enabled: false },
            { type: NotificationType.RegistrationCreated, channel: NotificationChannel.Push, enabled: false },
        ]);
        expect(first.status).toBe(200);
        expect(sorted(first.body)).toEqual([
            { type: NotificationType.RegistrationCreated, channel: NotificationChannel.InApp, enabled: false },
            { type: NotificationType.RegistrationCreated, channel: NotificationChannel.Push, enabled: false },
        ]);

        // Updating the same preference again does not create a duplicate row
        const second = await patch(user, [
            { type: NotificationType.RegistrationCreated, channel: NotificationChannel.InApp, enabled: true },
        ]);
        const expected = [
            { type: NotificationType.RegistrationCreated, channel: NotificationChannel.InApp, enabled: true },
            { type: NotificationType.RegistrationCreated, channel: NotificationChannel.Push, enabled: false },
        ];
        expect(sorted(second.body)).toEqual(expected);
        expect(await stored(user)).toEqual(expected);
        expect(await stored(other)).toEqual([]);
    });

    test('rejects unknown types, unknown channels and too many preferences without storing anything', async () => {
        const user = await new UserFactory({}).create();

        await expect(patch(user, [
            { type: NotificationType.RegistrationCreated, channel: NotificationChannel.InApp, enabled: false },
            { type: 'registration.unknown', channel: NotificationChannel.InApp, enabled: false },
        ])).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'type' }));

        await expect(patch(user, [
            { type: NotificationType.RegistrationCreated, channel: 'sms', enabled: false },
        ])).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'channel' }));

        const tooMany = Array.from({ length: Object.values(NotificationType).length * Object.values(NotificationChannel).length + 1 }, () => ({
            type: NotificationType.RegistrationCreated,
            channel: NotificationChannel.InApp,
            enabled: false,
        }));
        await expect(patch(user, tooMany)).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'body' }));

        expect(await stored(user)).toEqual([]);
    });

    test('requires authentication', async () => {
        await expect(patch(null, [])).rejects.toThrow(STExpect.simpleError({ code: 'not_authenticated' }));
    });
});
