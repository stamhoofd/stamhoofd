import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, EventNotification, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList } from '@stamhoofd/structures';
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
            });

            console.log('[Done] EventNotifications.fetch', data, response.data);
            return response.data;
        },

        async fetchCount(): Promise<number> {
            throw new Error('Method not implemented.');
        },

        ...overrides,

        get requiredFilter() {
            return overrides?.requiredFilter ?? null;
        },
    };
}
