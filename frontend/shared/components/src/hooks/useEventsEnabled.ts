import type { ComputedRef } from 'vue';
import { computed } from 'vue';
import { useContext } from './useContext';
import { useEventTypes } from './useEventTypes';
import { manualFeatureFlag } from './useFeatureFlag';
import { useOrganization } from './useOrganization';

/**
 * Whether the events/calendar feature should be shown for the current context.
 *
 * Mirrors the gating used to show the 'Activiteiten' tab in the member portal:
 * events need at least one configured event type, must not be disabled by a
 * feature flag, and the organization must have the calendar enabled (or, in
 * platform mode, events are always available).
 */
export function useEventsEnabled(): ComputedRef<boolean> {
    const eventTypes = useEventTypes();
    const context = useContext();
    const organization = useOrganization();

    return computed(() => {
        if (eventTypes.value.length === 0) {
            return false;
        }

        if (manualFeatureFlag('disable-events', context.value)) {
            return false;
        }

        const org = organization.value;
        return !org
            || STAMHOOFD.userMode === 'platform'
            || org.meta.enableCalendar === true
            || (org.meta.enableCalendar === null && org.hasFutureEvents);
    });
}
