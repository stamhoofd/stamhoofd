import { assertSort, CountFilteredRequest, CountResponse, LimitedFilteredRequest, MembersBlob, PaginatedResponseDecoder, PlatformFamily, PlatformMember, SortItemDirection, SortList } from '@stamhoofd/structures';
import { ObjectFetcher } from '../tables';
import { Decoder } from '@simonbackx/simple-encoding';
import { useContext, usePlatform } from '../hooks';

type ObjectType = PlatformMember;

function extendSort(list: SortList): SortList {
    // Map 'age' to 'birthDay' + reverse direction
    list = list.flatMap((l) => {
        if (l.key === 'age') {
            return [
                { key: 'birthDay', order: l.order === SortItemDirection.ASC ? SortItemDirection.DESC : SortItemDirection.ASC },
            ];
        }

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

export function useMembersObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();
    const platform = usePlatform();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            console.log('Members.fetch', data);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/members',
                decoder: new PaginatedResponseDecoder(MembersBlob as Decoder<MembersBlob>, LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Members.fetch', data, response.data);

            const blob = response.data.results;

            return {
                results: PlatformFamily.createSingles(blob, {
                    contextOrganization: context.value.organization,
                    platform: platform.value,
                }),
                next: response.data.next,
            };
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('Members.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/members/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Members.fetchCount', data, response.data.count);
            return response.data.count;
        },

        ...overrides,
    };
}
