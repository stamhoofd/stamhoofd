import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import type { CountFilteredRequest, SortList } from '@stamhoofd/structures';
import { assertSort, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, PlatformMembership } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import type { ObjectFetcher } from '../tables';

type ObjectType = PlatformMembership;

function extendSort(list: SortList): SortList {
    return assertSort(list, [{ key: 'id' }]);
}

export function usePlatformMemberhipsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            console.log('PlatformMemberships.fetch', data);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/platform-memberships',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(PlatformMembership as Decoder<PlatformMembership>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] PlatformMemberships.fetch', data, response.data);

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('PlatformMemberships.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/platform-memberships/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] PlatformMemberships.fetchCount', data, response.data.count);
            return response.data.count;
        },

        ...overrides,
    };
}
