import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform';
import { LimitedFilteredRequest, PaginatedResponseDecoder, RegistrationPeriod, SortItemDirection } from '@stamhoofd/structures';
import { useRequestOwner } from './useRequestOwner';

export function useFetchRegistrationPeriods() {
    const context = useContext();
    const owner = useRequestOwner();
    const organization = useOrganization();
    const platform = usePlatform();

    return async function ({ shouldRetry }: { shouldRetry?: boolean }) {
        // Load last 5 years
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 6);

        // Improve http caching
        startDate.setDate(1);
        startDate.setMonth(0);
        startDate.setHours(0, 0, 0, 0);

        // Request data
        const periodsResponse = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/registration-periods',
            query: new LimitedFilteredRequest({
                filter: {
                    startDate: {
                        $gt: startDate,
                    },
                },
                limit: 10,
                sort: [
                    {
                        key: 'startDate',
                        order: SortItemDirection.DESC,
                    },
                    {
                        key: 'id',
                        order: SortItemDirection.ASC,
                    },
                ],
            }),
            decoder: new PaginatedResponseDecoder(
                new ArrayDecoder(RegistrationPeriod as Decoder<RegistrationPeriod>),
                LimitedFilteredRequest,
            ),
            owner,
            shouldRetry,
        });

        if (organization.value) {
            for (const period of periodsResponse.data.results) {
                if (period.id === organization.value.period.period.id) {
                    organization.value.period.period.deepSet(period);
                }
            }
        }

        if (platform.value) {
            for (const period of periodsResponse.data.results) {
                if (period.id === platform.value.period.id) {
                    platform.value.period.deepSet(period);
                }
            }
        }

        return periodsResponse.data.results;
    };
}
