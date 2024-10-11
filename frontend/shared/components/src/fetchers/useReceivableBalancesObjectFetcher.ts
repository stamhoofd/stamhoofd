import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, ReceivableBalance, CountFilteredRequest, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = ReceivableBalance;

function extendSort(list: SortList): SortList {
    return assertSort(list, [{ key: 'id' }]);
}

export function useReceivableBalancesObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest) {
            console.log('ReceivableBalance.fetch', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/receivable-balances',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(ReceivableBalance as Decoder<ReceivableBalance>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
            });

            console.log('[Done] ReceivableBalance.fetch', data, response.data);

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('ReceivableBalance.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/receivable-balances/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
            });

            console.log('[Done] ReceivableBalance.fetchCount', data, response.data.count);
            return response.data.count;
        },
        ...overrides,
    };
}
