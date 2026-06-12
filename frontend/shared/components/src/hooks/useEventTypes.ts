import type { PlatformEventType } from '@stamhoofd/structures';
import { getEventTypes } from '@stamhoofd/structures';
import type { ComputedRef } from 'vue';
import { computed } from 'vue';
import { useOrganization } from './useOrganization';
import { usePlatform } from './usePlatform';

export function useEventTypes(): ComputedRef<PlatformEventType[]> {
    const platform = usePlatform();
    const organization = useOrganization();
    return computed(() => getEventTypes({ platform: platform.value, organization: organization.value }));
}
