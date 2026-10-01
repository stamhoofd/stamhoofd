import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { CountFilteredRequest, CountResponse } from '@stamhoofd/structures';
import { NotificationChannel } from '@stamhoofd/structures/notifications/NotificationChannel.js';
import { NotificationPreference } from '@stamhoofd/structures/notifications/NotificationPreference.js';
import type { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { UserNotification } from '@stamhoofd/structures/notifications/UserNotification.js';
import { useContext } from '#hooks/useContext.ts';

export function useNotificationActions() {
    const context = useContext();
    const owner = useRequestOwner();

    async function fetchUnreadCount(): Promise<number> {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/notifications/unread-count',
            query: new CountFilteredRequest({}),
            decoder: CountResponse as Decoder<CountResponse>,
            owner,
        });
        return response.data.count;
    }

    async function markAsRead(notification: UserNotification) {
        if (notification.readAt) {
            return;
        }
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/notifications/' + encodeURIComponent(notification.id) + '/read',
            decoder: UserNotification as Decoder<UserNotification>,
            owner,
            shouldRetry: false,
        });
        notification.deepSet(response.data);
    }

    async function markAllAsRead() {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/notifications/mark-all-read',
            decoder: CountResponse as Decoder<CountResponse>,
            owner,
            shouldRetry: false,
        });
    }

    async function fetchPreferences(): Promise<NotificationPreference[]> {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/notifications/preferences',
            decoder: new ArrayDecoder(NotificationPreference as Decoder<NotificationPreference>),
            owner,
        });
        return response.data;
    }

    async function setPreferences(preferences: NotificationPreference[]): Promise<NotificationPreference[]> {
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/notifications/preferences',
            body: preferences,
            decoder: new ArrayDecoder(NotificationPreference as Decoder<NotificationPreference>),
            // No owner: a save should complete when the view is closed while it is still pending
            shouldRetry: false,
        });
        return response.data;
    }

    async function unsubscribe(type: NotificationType) {
        await setPreferences(Object.values(NotificationChannel).map(channel => NotificationPreference.create({ type, channel, enabled: false })));
    }

    return {
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        fetchPreferences,
        setPreferences,
        unsubscribe,
    };
}
