import { useAppContext } from '#context/appContext.ts';
import { useEventUIFilterBuilders } from '#filters/filterBuilders.ts';
import type { UIFilter } from '#filters/UIFilter.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import type { Organization, PlatformMember, StamhoofdFilter } from '@stamhoofd/structures';
import { mergeFilters } from '@stamhoofd/structures';
import { computed } from 'vue';

/**
 * Filters for the events a member can be registered for, shared by RegisterMemberEventsBox and the default tab
 * check in ChooseGroupForMemberView, so the check finds exactly the events the box shows when it opens.
 */
export function useRegisterMemberEventsFilter({ member, organization }: { member: PlatformMember; organization: () => Organization | null }) {
    const app = useAppContext();
    const platform = usePlatform();

    const organizations = computed(() => {
        if (member.family.organizations.length > 0) {
            return member.family.organizations;
        }
        const o = organization();
        return o ? [o] : [];
    });

    const filterBuilders = useEventUIFilterBuilders({ platform: platform.value, organizations: () => organizations.value, app });

    function createRecommendedUIFilter(): UIFilter | null {
        return filterBuilders.value[0].fromFilter(member.family.getRecommendedEventsFilter());
    }

    function getRequiredFilter(): StamhoofdFilter {
        const filter: StamhoofdFilter = {
            startDate: {
                $gt: new Date(),
            },
            // Only events that can actually be registered for
            groupId: {
                $neq: null,
            },
        };

        if (app === 'registration') {
            filter['meta.visible'] = true;
        }

        // In organization mode there is only ever a single organization, so scope to it
        if (STAMHOOFD.userMode === 'organization' && organizations.value.length === 1) {
            filter['organizationId'] = organizations.value[0].id;
        }

        return filter;
    }

    /**
     * The filter of the box before the user searches or changes the filter
     */
    function getInitialFilter(): StamhoofdFilter {
        return mergeFilters([createRecommendedUIFilter()?.build() ?? null, getRequiredFilter()]);
    }

    return { filterBuilders, createRecommendedUIFilter, getRequiredFilter, getInitialFilter };
}
