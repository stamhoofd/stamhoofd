import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, CachedOutstandingBalance, CountFilteredRequest, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = CachedOutstandingBalance;

function extendSort(list: SortList): SortList {
    return assertSort(list, [{ key: 'id' }]);
}

export function useCachedOutstandingBalanceObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest) {
            console.log('CachedOutstandingBalance.fetch', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/cached-outstanding-balance',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(CachedOutstandingBalance as Decoder<CachedOutstandingBalance>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
            });

            console.log('[Done] CachedOutstandingBalance.fetch', data, response.data);

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('CachedOutstandingBalance.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/cached-outstanding-balance/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
            });

            console.log('[Done] CachedOutstandingBalance.fetchCount', data, response.data.count);
            return response.data.count;
        },
        ...overrides,
    };
}
