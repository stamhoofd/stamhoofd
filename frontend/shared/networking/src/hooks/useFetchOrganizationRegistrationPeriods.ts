import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import type { Organization } from '@stamhoofd/structures';
import { LimitedFilteredRequest, OrganizationRegistrationPeriod, PaginatedResponseDecoder, RegistrationPeriodList, SortItemDirection } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { useFetchRegistrationPeriods } from './useFetchRegistrationPeriods';
import { useRequestOwner } from './useRequestOwner';
import { reactive } from 'vue';
import type { Ref } from 'vue';

const periodsCache = new Map<string, RegistrationPeriodList>();

export function clearOrganizationPeriodsCache() {
    periodsCache.clear();
}

export function useFetchOrganizationRegistrationPeriods({ organization }: { organization?: Ref<Organization> } = {}) {
    const context = useContext();
    const owner = useRequestOwner();
    const fetchPeriods = useFetchRegistrationPeriods({ organization });
    organization = organization ?? useRequiredOrganization();

    return async function ({ shouldRetry, force }: { shouldRetry?: boolean; force?: boolean }) {
        const cache = periodsCache.get(organization.value.id);
        if (!force && cache) {
            return cache;
        }

        // Request data
        const periods = await fetchPeriods({ shouldRetry });

        let organizationPeriods: OrganizationRegistrationPeriod[] = [];

        if (periods.length !== 0) {
            const response = await context.value.getAuthenticatedServerForOrganization(organization.value.id).request({
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

            for (const period of organizationPeriods) {
                if (period.id === organization.value.period.id) {
                    organization.value.period.deepSet(period);
                }
            }
        }

        organizationPeriods.sort((a, b) => Sorter.byDateValue(a.period.startDate, b.period.startDate));

        const list = RegistrationPeriodList.create({
            organizationPeriods: organizationPeriods,
            periods: periods,
        });

        if (!cache) {
            // Using 'reactive' is required when the periods are not immediately used in vue and not made reactive automatically
            // it prevents issues where computed properties won't update because they are not using the reactive version of an organization period
            periodsCache.set(organization.value.id, reactive(list) as unknown as RegistrationPeriodList);
        } else {
            cache.deepSet(list);
        }

        return list;
    };
}
