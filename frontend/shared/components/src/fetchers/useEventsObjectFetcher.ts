import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, Event, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = Event;

function extendSort(list: SortList): SortList {
    return assertSort(list, [
        { key: 'startDate', order: SortItemDirection.ASC },
        { key: 'id' },
    ]);
}

export function useEventsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,

        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            console.log('Events.fetch', data);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/events',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(Event as Decoder<Event>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
            });

            console.log('[Done] Events.fetch', data, response.data);
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
