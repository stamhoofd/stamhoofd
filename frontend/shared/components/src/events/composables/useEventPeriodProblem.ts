import { useFetchOrganizationRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods';
import type { Organization } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { ref, watch } from 'vue';

export type EventPeriodProblem =
    /** No registration period covers the start date at all */
    | { type: 'missing-period' }
    /** The organizer never started the period that covers the start date */
    | { type: 'period-not-started'; periodName: string };

/**
 * The organization always has its current period, and registrations for activities in the past are
 * an edge case the backend refuses on its own. So only a future activity outside the current period
 * is worth a lookup.
 */
function needsLookup(organization: Organization, startDate: Date) {
    const current = organization.period.period;

    if (startDate >= current.startDate && startDate <= current.endDate) {
        return false;
    }

    return startDate > new Date();
}

/**
 * Registrations for an activity live in a group in the period of its start date, and that group is
 * only reachable once the organizer has started that period (see useFetchOrganizationPeriodForGroup).
 * Resolves to null while the organizer is unknown (a national activity) or nothing is wrong.
 */
export function useGetEventPeriodProblem(organization: Ref<Organization | null>) {
    const fetchPeriods = useFetchOrganizationRegistrationPeriods({ organization: organization as Ref<Organization> });

    return async function (startDate: Date): Promise<EventPeriodProblem | null> {
        const currentOrganization = organization.value;

        if (!currentOrganization || !needsLookup(currentOrganization, startDate)) {
            return null;
        }

        const list = await fetchPeriods({ shouldRetry: false });
        const period = list.periods.find(p => p.startDate <= startDate && p.endDate >= startDate);

        if (!period) {
            return { type: 'missing-period' };
        }

        if (list.organizationPeriods.some(p => p.period.id === period.id)) {
            return null;
        }

        return { type: 'period-not-started', periodName: period.nameShort };
    };
}

/**
 * Reactive variant of useGetEventPeriodProblem, for showing the problem while editing.
 */
export function useEventPeriodProblem(organization: Ref<Organization | null>, startDate: Ref<Date>) {
    const getProblem = useGetEventPeriodProblem(organization);
    const problem = ref(null) as Ref<EventPeriodProblem | null>;
    let checkCount = 0;

    watch([organization, startDate], async () => {
        const count = ++checkCount;

        try {
            const result = await getProblem(startDate.value);

            if (count === checkCount) {
                problem.value = result;
            }
        }
        catch (e) {
            console.error(e);

            if (count === checkCount) {
                problem.value = null;
            }
        }
    }, { immediate: true });

    return problem;
}
