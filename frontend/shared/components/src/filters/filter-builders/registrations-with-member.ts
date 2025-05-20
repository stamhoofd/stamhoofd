import { computed } from 'vue';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { useAdvancedRegistrationsUIFilterBuilders } from './registrations';

export function useAdvancedRegistrationWithMemberUIFilterBuilders() {
    const { loading, filterBuilders: registrationFilters } = useAdvancedRegistrationsUIFilterBuilders();

    const filterBuilders = computed(() => {
        const all = [...registrationFilters.value];

        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }));

        return all;
    });

    return {
        loading,
        filterBuilders,
    };
}
