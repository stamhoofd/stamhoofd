import { Decoder } from '@simonbackx/simple-encoding';
import { assertSort, CountFilteredRequest, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, PlatformRegistration, RegistrationsBlob, SortItemDirection, SortList } from '@stamhoofd/structures';
import { useContext, usePlatform } from '../hooks';
import { ObjectFetcher } from '../tables';

type ObjectType = PlatformRegistration;

function extendSort(list: SortList): SortList {
    // Map 'age' to 'birthDay' + reverse direction
    list = list.flatMap((l) => {
        if (l.key === 'member.age') {
            return [
                { key: 'member.birthDay', order: l.order === SortItemDirection.ASC ? SortItemDirection.DESC : SortItemDirection.ASC },
            ];
        }

        if (l.key === 'member.name') {
            return [
                { key: 'member.firstName', order: l.order },
                { key: 'member.lastName', order: l.order },
            ];
        }

        return [l];
    });

    return assertSort(list, [{ key: 'id' }]);
}

export function useRegistrationsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();
    const platform = usePlatform();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            console.log('Registrations.fetch', data);
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/registrations',
                decoder: new PaginatedResponseDecoder(RegistrationsBlob as Decoder<RegistrationsBlob>, LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Registrations.fetch', data, response.data);

            const results = PlatformRegistration.createSingles(response.data.results, {
                contextOrganization: context.value.organization,
                platform: platform.value,
            });

            return {
                results,
                next: response.data.next,
            };
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('Registrations.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/registrations/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] Registrations.fetchCount', data, response.data.count);
            return response.data.count;
        },

        ...overrides,
    };
}
