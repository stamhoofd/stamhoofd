import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import type { Organization, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue, watch } from 'vue';
import { getCachedOrganizationPeriods, useFetchOrganizationRegistrationPeriods } from './useFetchOrganizationRegistrationPeriods.js';

/**
 * The organization period a period id belongs to. The periods are only fetched when the id is not the
 * period the organization is currently using.
 */
export function useOrganizationRegistrationPeriod(periodId: MaybeRefOrGetter<string | null | undefined>, options?: { organization?: Ref<Organization | null> }) {
    const contextOrganization = useOrganization();
    const organization = options?.organization ?? contextOrganization;
    const fetchPeriods = useFetchOrganizationRegistrationPeriods({ organization: organization as Ref<Organization> });

    watch([() => toValue(periodId), organization], ([id, org]) => {
        if (!org || !id || org.period.period.id === id || getCachedOrganizationPeriods(org.id)) {
            return;
        }
        fetchPeriods({ shouldRetry: false }).catch(console.error);
    }, { immediate: true });

    return computed((): OrganizationRegistrationPeriod | undefined => {
        const id = toValue(periodId);
        const org = organization.value;

        if (!org || !id) {
            return undefined;
        }

        if (org.period.period.id === id) {
            return org.period;
        }

        return getCachedOrganizationPeriods(org.id)?.organizationPeriods.find(p => p.period.id === id);
    });
}
