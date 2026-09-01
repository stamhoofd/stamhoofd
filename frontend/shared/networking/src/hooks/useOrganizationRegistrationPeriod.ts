import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import type { Organization, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, watch } from 'vue';
import { getCachedOrganizationPeriods } from '../organizationPeriodsCache.js';
import { useFetchOrganizationRegistrationPeriods } from './useFetchOrganizationRegistrationPeriods.js';

/**
 * The organization period a period id belongs to. The periods are only fetched when the id is not the
 * period the organization is currently using.
 */
export function useOrganizationRegistrationPeriod(periodId: string | null | undefined, options?: { organization?: Ref<Organization | null> }) {
    const contextOrganization = useOrganization();
    const organization = options?.organization ?? contextOrganization;
    const fetchPeriods = useFetchOrganizationRegistrationPeriods({ organization: organization as Ref<Organization> });

    watch(organization, (org) => {
        if (!org || !periodId || org.period.period.id === periodId || getCachedOrganizationPeriods(org.id)) {
            return;
        }
        fetchPeriods({ shouldRetry: false }).catch(console.error);
    }, { immediate: true });

    return computed((): OrganizationRegistrationPeriod | undefined => {
        const org = organization.value;

        if (!org || !periodId) {
            return undefined;
        }

        if (org.period.period.id === periodId) {
            return org.period;
        }

        return getCachedOrganizationPeriods(org.id)?.organizationPeriods.find(p => p.period.id === periodId);
    });
}
