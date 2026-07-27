import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform';
import type { Organization } from '@stamhoofd/structures';
import { LimitedFilteredRequest, PaginatedResponseDecoder, RegistrationPeriod, SortItemDirection } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { ref } from 'vue';
import { useRequestOwner } from './useRequestOwner';

/**
 * All registration periods, cached at module level so every consumer shares one list and one
 * request. It is a ref because consumers render it while it is still loading.
 */
const allPeriodsCache = ref(null) as Ref<RegistrationPeriod[] | null>;

/**
 * De-duplicates concurrent fetches: callers that don't force a refresh wait for a running request
 * instead of starting a second one.
 */
let pendingAllPeriods: Promise<RegistrationPeriod[]> | null = null;

export function clearRegistrationPeriodsCache() {
    allPeriodsCache.value = null;
}

/**
 * Reactive access to the cached list of all registration periods, without fetching anything.
 * Null as long as useFetchAllRegistrationPeriods didn't load them (yet).
 */
export function useAllRegistrationPeriods(): Ref<RegistrationPeriod[] | null> {
    return allPeriodsCache;
}

/**
 * Fetch all registration periods, and cache them (see useAllRegistrationPeriods).
 *
 * Unlike useFetchRegistrationPeriods this is not limited to the recent periods, and it uses the
 * optionally authenticated server so it also works without a token.
 */
export function useFetchAllRegistrationPeriods() {
    const context = useContext();
    const owner = useRequestOwner();

    return async function ({ shouldRetry, force }: { shouldRetry?: boolean; force?: boolean } = {}): Promise<RegistrationPeriod[]> {
        if (!force) {
            if (pendingAllPeriods && !allPeriodsCache.value) {
                await pendingAllPeriods;
            }

            if (allPeriodsCache.value) {
                return allPeriodsCache.value;
            }
        }

        const pending = (async () => {
            const response = await context.value.optionalAuthenticatedServer.request({
                method: 'GET',
                path: '/registration-periods',
                query: new LimitedFilteredRequest({
                    limit: 100,
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
                shouldRetry: shouldRetry ?? false,
            });
            const data = response.data.results;
            allPeriodsCache.value = data;
            return data;
        })();
        pendingAllPeriods = pending;

        try {
            return await pending;
        } finally {
            if (pendingAllPeriods === pending) {
                pendingAllPeriods = null;
            }
        }
    };
}

export function useFetchRegistrationPeriods({ organization }: { organization?: Ref<Organization | null> | undefined } = {}) {
    const context = useContext();
    const owner = useRequestOwner();
    organization = organization ?? useOrganization();
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
        const periodsResponse = await (organization.value ? context.value.getAuthenticatedServerForOrganization(organization.value.id) : context.value.authenticatedServer).request({
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
