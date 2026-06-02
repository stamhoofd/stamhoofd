import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { LimitedFilteredRequest, OrganizationRegistrationPeriod, PaginatedResponseDecoder, RegistrationPeriodList, SortItemDirection } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { useFetchRegistrationPeriods } from './useFetchRegistrationPeriods';
import { useRequestOwner } from './useRequestOwner';

const periodsCache = new Map<string, RegistrationPeriodList>();

export function useFetchOrganizationRegistrationPeriods() {
    const context = useContext();
    const owner = useRequestOwner();
    const fetchPeriod = useFetchRegistrationPeriods();
    const organization = useRequiredOrganization();

    return async function ({ shouldRetry, force }: { shouldRetry?: boolean; force?: boolean }) {
        const cache = periodsCache.get(organization.value.id);
        if (!force && cache) {
            return cache;
        }

        // Request data
        const periods = await fetchPeriod({ shouldRetry });

        let organizationPeriods: OrganizationRegistrationPeriod[] = [];

        if (periods.length !== 0) {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/organization/registration-periods',
                query: new LimitedFilteredRequest({
                    filter: {
                        periodId: {
                            $in: periods.map(p => p.id),
                        },
                    },
                    limit: 20,
                    sort: [
                        {
                            key: 'id',
                            order: SortItemDirection.ASC,
                        },
                    ],
                }),
                decoder: new PaginatedResponseDecoder(
                    new ArrayDecoder(OrganizationRegistrationPeriod as Decoder<OrganizationRegistrationPeriod>),
                    LimitedFilteredRequest,
                ),
                owner,
                shouldRetry,
            });
            organizationPeriods = response.data.results;
        }

        organizationPeriods.sort((a, b) => Sorter.byDateValue(a.period.startDate, b.period.startDate));

        const list = RegistrationPeriodList.create({
            organizationPeriods: organizationPeriods,
            periods: periods,
        });

        if (!cache) {
            periodsCache.set(organization.value.id, list);
        } else {
            cache.deepSet(list);
        }

        return list;
    };
}
