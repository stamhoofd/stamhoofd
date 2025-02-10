import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, CountFilteredRequest, CountResponse, EventNotification, LimitedFilteredRequest, PaginatedResponseDecoder, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = EventNotification;

function extendSort(list: SortList): SortList {
    return assertSort(list, [
        { key: 'id' },
    ]);
}

export function useEventNotificationsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,

        async fetch(data: LimitedFilteredRequest, options?: { shouldRetry?: boolean }): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            console.log('EventNotifications.fetch', data);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/event-notifications',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(EventNotification as Decoder<EventNotification>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: options?.shouldRetry ?? false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] EventNotifications.fetch', data, response.data);
            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('EventNotifications.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/event-notifications/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] EventNotifications.fetchCount', data, response.data.count);
            return response.data.count;
        },

        ...overrides,

        get requiredFilter() {
            return overrides?.requiredFilter ?? null;
        },
    };
}
