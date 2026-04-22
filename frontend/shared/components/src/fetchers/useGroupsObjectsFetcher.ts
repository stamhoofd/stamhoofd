import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import type { CountFilteredRequest, SortList } from '@stamhoofd/structures';
import { assertSort, CountResponse, Group, LimitedFilteredRequest, PaginatedResponseDecoder } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import type { ObjectFetcher } from '../tables';

type ObjectType = Group;

function extendSort(list: SortList): SortList {
    return assertSort(list, [{ key: 'id' }]);
}

export function useGroupsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest) {
            console.log('Groups.fetch', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/groups',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(Group as Decoder<Group>), LimitedFilteredRequest),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Groups.fetch', data, response.data);

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('Groups.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/groups/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Groups.fetchCount', data, response.data.count);
            return response.data.count;
        },
        ...overrides,
    };
}
