import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import type { CountFilteredRequest, SortList } from '@stamhoofd/structures';
import { assertSort, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, PrivateDiscountCode } from '@stamhoofd/structures';
import { useContext } from '#hooks/useContext.ts';
import type { ObjectFetcher } from '#tables/classes/ObjectFetcher.ts';

type ObjectType = PrivateDiscountCode;

function extendSort(list: SortList): SortList {
    return assertSort(list, [{ key: 'id' }]);
}

export function useDiscountCodesObjectFetcher(webshopId: string, overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: `/webshop/${webshopId}/discount-codes`,
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(PrivateDiscountCode as Decoder<PrivateDiscountCode>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
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
                path: `/webshop/${webshopId}/discount-codes/count`,
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
