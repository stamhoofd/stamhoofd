import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, BalanceItem, CountFilteredRequest, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';
import { SessionContext } from '@stamhoofd/networking';
import { Ref } from 'vue';

type ObjectType = BalanceItem;

function extendSort(list: SortList): SortList {
    return assertSort(list, [{ key: 'createdAt', order: SortItemDirection.DESC }, { key: 'id' }]);
}

export function getBalanceItemsObjectFetcher(context: Ref<SessionContext>, overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/balance-items',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(BalanceItem as Decoder<BalanceItem>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/balance-items/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            return response.data.count;
        },

        ...overrides,
    };
}

export function useBalanceItemsFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();
    return getBalanceItemsObjectFetcher(context, overrides);
}
