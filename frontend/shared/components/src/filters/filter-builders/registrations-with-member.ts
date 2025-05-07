import { computed } from 'vue';
import { useFinancialSupportSettings } from '../../groups';
import { useAuth, useOrganization, usePlatform, useUser } from '../../hooks';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { wrapFilters } from './helpers';
import { createMemberWithRegistrationsBlobFilterBuilders, useAdvancedPlatformMembershipUIFilterBuilders } from './members';
import { useAdvancedRegistrationsUIFilterBuilders } from './registrations';

export function useAdvancedRegistrationWithMemberUIFilterBuilders() {
    const $platform = usePlatform();
    const $user = useUser();

    const { loading, filterBuilders: registrationFilters } = useAdvancedRegistrationsUIFilterBuilders();
    const financialSupportSettings = useFinancialSupportSettings();
    const auth = useAuth();
    const organization = useOrganization();
    const { loading: loadingMembershipFilters, filterBuilders: membershipFilters } = useAdvancedPlatformMembershipUIFilterBuilders();

    const filterBuilders = computed(() => {
        const originalFilters = createMemberWithRegistrationsBlobFilterBuilders({ organization, $user, $platform, financialSupportSettings, auth, registrationFilters, membershipFilters });

        const all = wrapFilters(originalFilters, { key: 'member' });

        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    });
    //     if (filter.wrapper) {
    //         filter.wrapper = {
    //             member: {
    //                 $elemMatch: filter.wrapper,
    //             },
    //         };
    //     }
    //     else {
    //         filter.wrapper = {
    //             member: {
    //                 $elemMatch: FilterWrapperMarker,
    //             },
    //         };
    //     }

    //     console.error('filter.wrapper', filter.wrapper);

    //     const unwrapFilter = filter.unwrapFilter;

    //     filter.unwrapFilter = (f: StamhoofdFilter) => {
    //         if (unwrapFilter) {
    //             return unwrapFilter(f);
    //         }

    //         // todo?
    //         return null;
    //     };

    //     return filter;
    // }));

    return {
        loading: computed(() => loading.value || loadingMembershipFilters.value),
        filterBuilders,
    };
}
