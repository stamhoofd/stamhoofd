import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, CountFilteredRequest, CountResponse, EmailRecipient, LimitedFilteredRequest, PaginatedResponseDecoder, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = EmailRecipient;

function extendSort(list: SortList): SortList {
    list = list.flatMap((l) => {
        if (l.key === 'name') {
            return [
                { key: 'firstName', order: l.order },
                { key: 'lastName', order: l.order },
            ];
        }

        return [l];
    });

    return assertSort(list, [{ key: 'id' }]);
}

export function useEmailRecipientsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,

        async fetch(data: LimitedFilteredRequest, options?: { shouldRetry?: boolean }): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            console.log('EmailRecipients.fetch', data);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/email-recipients',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(EmailRecipient as Decoder<EmailRecipient>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: options?.shouldRetry ?? false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] EmailRecipients.fetch', data, response.data);
            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('EmailRecipients.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/email-recipients/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] EmailRecipients.fetchCount', data, response.data.count);
            return response.data.count;
        },

        ...overrides,

        get requiredFilter() {
            return overrides?.requiredFilter ?? null;
        },
    };
}
