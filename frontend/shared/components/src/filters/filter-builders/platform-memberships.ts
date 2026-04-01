import { GroupUIFilterBuilder } from '../GroupUIFilter';
import type { UIFilterBuilders } from '../UIFilter';

export function useGetPlatformMembershipsUIFilterBuilders() {
    const getWebshopUIFilterBuilders = (): UIFilterBuilders => {
        const builders: UIFilterBuilders = [
        ];

        // Put a GroupUIFilterBuilder first so it can parse any filter structure,
        // including the defaultFilter which uses $or for the status.
        // ModernTableView uses filterBuilders[0].fromFilter(defaultFilter) to restore state.
        builders.unshift(new GroupUIFilterBuilder({ builders }));

        return builders;
    };

    return { getWebshopUIFilterBuilders };
}
