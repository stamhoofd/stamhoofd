import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, CountFilteredRequest, CountResponse, Document, LimitedFilteredRequest, PaginatedResponseDecoder, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = Document;

function extendSort(list: SortList): SortList {
    return assertSort(list, [{ key: 'id' }]);
}

export function useDocumentsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            console.log('Documents.fetch', data);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/organization/documents',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(Document as Decoder<Document>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Documents.fetch', data, response.data);

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('Documents.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/organization/documents/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Documents.fetchCount', data, response.data.count);
            return response.data.count;
        },

        ...overrides,
    };
}
