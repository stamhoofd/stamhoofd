import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import type { CountFilteredRequest, SortList } from '@stamhoofd/structures';
import { assertSort, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, RegistrationPeriod, SortItemDirection } from '@stamhoofd/structures';
import { useContext } from '#hooks/useContext.ts';
import type { ObjectFetcher } from '#tables/classes/ObjectFetcher.ts';

type ObjectType = RegistrationPeriod;

function extendSort(list: SortList): SortList {
    return assertSort(list, [
        { key: 'startDate', order: SortItemDirection.DESC },
        { key: 'id' },
    ]);
}

export function useRegistrationPeriodsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest, options?: { shouldRetry?: boolean }) {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/registration-periods',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(RegistrationPeriod as Decoder<RegistrationPeriod>), LimitedFilteredRequest),
                query: data,
                shouldRetry: options?.shouldRetry ?? false,
                owner: this,
                timeout: 30 * 1000,
            });

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/registration-periods/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            return response.data.count;
        },
        ...overrides,
    };
}
