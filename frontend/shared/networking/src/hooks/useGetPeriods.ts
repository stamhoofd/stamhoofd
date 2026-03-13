import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { LimitedFilteredRequest, PaginatedResponseDecoder, RegistrationPeriod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { useRequestOwner } from './useRequestOwner';

export function useGetPeriods() {
    const context = useContext();
    const owner = useRequestOwner();

    return async (periodIds: string[], shouldRetry?: boolean) => {
        if (periodIds.length === 0) {
            return [];
        }

        const uniqueIds = Formatter.uniqueArray(periodIds);

        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/registration-periods',
            query: new LimitedFilteredRequest({
                filter: {
                    id: {
                        $in: uniqueIds,
                    },
                },
                limit: uniqueIds.length,
            }),
            decoder: new PaginatedResponseDecoder(
                new ArrayDecoder(RegistrationPeriod as Decoder<RegistrationPeriod>),
                LimitedFilteredRequest,
            ),
            owner,
            shouldRetry,
        });

        return response.data.results;
    };

}
