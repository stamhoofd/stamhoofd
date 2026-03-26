import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import type { CountFilteredRequest, SortList } from '@stamhoofd/structures';
import { assertSort, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, WebshopWithOrganization } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import type { ObjectFetcher } from '../tables';

type ObjectType = WebshopWithOrganization;

function extendSort(list: SortList): SortList {
    return assertSort(list, [{ key: 'id' }]);
}

export function useWebshopsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest) {
            console.log('Webshops.fetch', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/webshops',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(WebshopWithOrganization as Decoder<WebshopWithOrganization>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Webshops.fetch', data, response.data);

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('Webshops.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/webshops/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Webshops.fetchCount', data, response.data.count);
            return response.data.count;
        },
        ...overrides,
    };
}
