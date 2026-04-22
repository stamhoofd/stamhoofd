import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import type { CountFilteredRequest, SortList } from '@stamhoofd/structures';
import { assertSort, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, RegistrationInvitation } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import type { ObjectFetcher } from '../tables';

type ObjectType = RegistrationInvitation;

function extendSort(list: SortList): SortList {
    return assertSort(list, [{ key: 'id' }]);
}

export function useRegistrationInvitationsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest) {
            console.log('RegistrationInvitations.fetch', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/registration-invitations',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(RegistrationInvitation as Decoder<RegistrationInvitation>), LimitedFilteredRequest),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] RegistrationInvitations.fetch', data, response.data);

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('RegistrationInvitations.fetchCount', data);

            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/registration-invitations/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            console.log('[Done] RegistrationInvitations.fetchCount', data, response.data.count);
            return response.data.count;
        },
        ...overrides,
    };
}
