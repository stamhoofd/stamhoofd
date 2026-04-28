import type { StamhoofdFilter } from '@stamhoofd/structures';
import { FilterWrapperMarker, WebshopStatus, getWebshopStatusName } from '@stamhoofd/structures';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterMode, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilterBuilders } from '../UIFilter';
import { useGetOrganizationUIFilterBuilders } from './organizations';

export function useGetWebshopUIFilterBuilders() {
    const {getOrganizationUIFilterBuilders} = useGetOrganizationUIFilterBuilders()
    const getWebshopUIFilterBuilders = (): UIFilterBuilders => {
        const builders: UIFilterBuilders = [
            new StringFilterBuilder({
                name: $t('%1Os'),
                key: 'name',
            }),

            new MultipleChoiceFilterBuilder({
                name: $t('%1JM'),
                multipleChoiceConfiguration: {
                    isSubjectPlural: false,
                    mode: MultipleChoiceUIFilterMode.Or,
                    showOptionSelectAll: false,
                },
                options: [
                    new MultipleChoiceUIFilterOption(getWebshopStatusName(WebshopStatus.Open), WebshopStatus.Open),
                    new MultipleChoiceUIFilterOption(getWebshopStatusName(WebshopStatus.Closed), WebshopStatus.Closed),
                    new MultipleChoiceUIFilterOption(getWebshopStatusName(WebshopStatus.Archived), WebshopStatus.Archived),
                ],
                wrapper: {
                    status: {$in: FilterWrapperMarker}
                },
                additionalUnwrappers: [{
                    status: FilterWrapperMarker
                }]
            }),

            new GroupUIFilterBuilder({
                name: $t(`%1PI`),
                builders: getOrganizationUIFilterBuilders().slice(1),
                wrapper: {
                    organization: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
        ];

        // Put a GroupUIFilterBuilder first so it can parse any filter structure,
        // including the defaultFilter which uses $or for the status.
        // ModernTableView uses filterBuilders[0].fromFilter(defaultFilter) to restore state.
        builders.unshift(new GroupUIFilterBuilder({ builders }));

        return builders;
    };

    return { getWebshopUIFilterBuilders };
}
