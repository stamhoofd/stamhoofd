import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, AuditLog, LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = AuditLog;

function extendSort(list: SortList): SortList {
    return assertSort(list, [
        { key: 'id', order: SortItemDirection.DESC },
    ]);
}

export function useAuditLogsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,

        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            console.log('AuditLogs.fetch', data);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/audit-logs',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(AuditLog as Decoder<AuditLog>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
            });

            console.log('[Done] AuditLogs.fetch', data, response.data);
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
