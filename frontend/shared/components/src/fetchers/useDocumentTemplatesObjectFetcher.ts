import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, CountFilteredRequest, CountResponse, DocumentTemplatePrivate, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = DocumentTemplatePrivate;

function extendSort(list: SortList): SortList {
    return assertSort(list, [
        { key: 'year' },
        { key: 'createdAt', order: SortItemDirection.DESC },
        { key: 'id' },
    ]);
}

export function useDocumentTemplatesObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            console.log('Document-templates.fetch', data);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/organization/document-templates',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Document-templates.fetch', data, response.data);

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('Document-templates.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/organization/document-templates/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Document-templates.fetchCount', data, response.data.count);
            return response.data.count;
        },

        ...overrides,

        get requiredFilter() {
            return overrides?.requiredFilter ?? null;
        },
    };
}
