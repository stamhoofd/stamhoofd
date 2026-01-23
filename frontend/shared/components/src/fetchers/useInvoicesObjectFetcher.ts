import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SessionContext } from '@stamhoofd/networking';
import { assertSort, CountFilteredRequest, CountResponse, Invoice, LimitedFilteredRequest, PaginatedResponseDecoder, SortList } from '@stamhoofd/structures';
import { Ref } from 'vue';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = Invoice;

function extendSort(list: SortList): SortList {
    // Map 'number' to 'invoicedAt'
    list = list.flatMap((l) => {
        if (l.key === 'number') {
            return [
                { key: 'invoicedAt', order: l.order },
            ];
        }

        return [l];
    });

    return assertSort(list, [{ key: 'id' }]);
}

export function getInvoicesObjectFetcher(context: Ref<SessionContext>, overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/invoices',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(Invoice as Decoder<Invoice>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 20 * 1000,
            });

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/invoices/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 20 * 1000,
            });

            return response.data.count;
        },

        ...overrides,
    };
}

export function useInvoicesObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();
    return getInvoicesObjectFetcher(context, overrides);
}
