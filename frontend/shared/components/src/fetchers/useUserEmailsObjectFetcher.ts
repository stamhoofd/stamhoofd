import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, EmailWithRecipients, LimitedFilteredRequest, PaginatedResponseDecoder, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = EmailWithRecipients;

function extendSort(list: SortList): SortList {
    return assertSort(list, [
        { key: 'id' },
    ]);
}

export function useUserEmailsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,

        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            console.log('EmailWithRecipients.fetch', data);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/user/email',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(EmailWithRecipients as Decoder<EmailWithRecipients>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] EmailWithRecipients.fetch', data, response.data);
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
