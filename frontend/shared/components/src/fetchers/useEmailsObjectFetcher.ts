import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, EmailPreview, LimitedFilteredRequest, PaginatedResponseDecoder, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = EmailPreview;

function extendSort(list: SortList): SortList {
    return assertSort(list, [
        { key: 'id' },
    ]);
}

export function useEmailsObjectFetcher(user: boolean = false, overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,

        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            console.log('Emails.fetch', data);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: user ? '/user/email' : '/email',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(EmailPreview as Decoder<EmailPreview>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Emails.fetch', data, response.data);
            return response.data;
        },

        async fetchCount(): Promise<number> {
            throw new Error('Method not implemented.');
        },

        ...overrides,

        get requiredFilter() {
            return overrides?.requiredFilter ?? null;
        },
    };
}
