import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import type { RegistrationPeriodBase, StamhoofdFilter } from '@stamhoofd/structures';
import { Event, EventPeriodHelper, LimitedFilteredRequest, mergeFilters, PaginatedResponseDecoder, SortItemDirection } from '@stamhoofd/structures';
import { useRequestOwner } from './useRequestOwner';

function useFetchEvents() {
    const context = useContext();
    const owner = useRequestOwner();

    return async (query: LimitedFilteredRequest, shouldRetry?: boolean) => {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/events',
            query,
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(Event as Decoder<Event>), LimitedFilteredRequest),
            owner,
            shouldRetry,
        });

        return response.data.results;
    };
}

export function useSearchEventsInPeriod() {
    const fetchEvents = useFetchEvents();

    return async ({ period, search, filter, limit = 100 }: { period: RegistrationPeriodBase; search?: string | null; filter?: StamhoofdFilter | null; limit?: number }, shouldRetry?: boolean) => {
        return await fetchEvents(new LimitedFilteredRequest({
            limit,
            filter: mergeFilters([EventPeriodHelper.getPeriodFilter(period), filter ?? null]),
            search: search || null,
            sort: [{ key: 'startDate', order: SortItemDirection.ASC }, { key: 'id', order: SortItemDirection.ASC }],
        }), shouldRetry);
    };
}
