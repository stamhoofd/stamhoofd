import type { RegistrationPeriodList } from '@stamhoofd/structures';
import { shallowReactive } from 'vue';

// Reactive so a synchronous read re-evaluates once the periods are fetched. Shallow: the lists themselves
// are made reactive when they are stored.
const periodsCache = shallowReactive(new Map<string, unknown>()) as unknown as Map<string, RegistrationPeriodList>;

export function clearOrganizationPeriodsCache() {
    periodsCache.clear();
}

export function getCachedOrganizationPeriods(organizationId: string): RegistrationPeriodList | undefined {
    return periodsCache.get(organizationId);
}

export function setCachedOrganizationPeriods(organizationId: string, list: RegistrationPeriodList) {
    periodsCache.set(organizationId, list);
}
