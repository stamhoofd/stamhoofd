import { useRequestOwner } from '@stamhoofd/networking';
import { Event, EventNotification, LimitedFilteredRequest } from '@stamhoofd/structures';
import { ref, Ref } from 'vue';
import { ErrorBox } from '#errors/ErrorBox';
import { useErrors } from '#errors/useErrors';
import { useEventNotificationsObjectFetcher } from '#fetchers/useEventNotificationsObjectFetcher';

export function useEventNotification(data: { event: Event; typeId: string }) {
    // Find event notifiation for this event and type
    const eventNotificationFetcher = useEventNotificationsObjectFetcher();
    useRequestOwner(eventNotificationFetcher);

    if (!data.event.organizationId) {
        return {
            notification: ref(null) as Ref<EventNotification | null>,
            promise: Promise.resolve(null),
            loading: ref(false),
            errors: useErrors(),
        };
    }

    // Load
    const request = new LimitedFilteredRequest({
        filter: {
            events: {
                $elemMatch: {
                    id: data.event.id,
                },
            },
            typeId: data.typeId,
        },
        limit: 1,
    });
    const promise = eventNotificationFetcher.fetch(request, { shouldRetry: true });
    const notification = ref(null) as Ref<EventNotification | null>;
    const loading = ref(true);
    const errors = useErrors();

    promise.then((notifications) => {
        if (notifications.results.length >= 1) {
            notification.value = notifications.results[0];
        }
        loading.value = false;
    }).catch((e: Error) => {
        errors.errorBox = new ErrorBox(e);
        loading.value = false;
    });

    return {
        notification,
        promise: promise.then(() => notification.value),
        loading,
        errors,
    };
}
