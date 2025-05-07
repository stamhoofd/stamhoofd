import { FilterWrapperMarker, StamhoofdFilter } from '@stamhoofd/structures';
import { UIFilter, UIFilterBuilder } from '../UIFilter';

export type WrapFilterOptions = {
    key: string;
};

export function wrapFilters(filters: UIFilterBuilder<UIFilter>[], options: WrapFilterOptions) {
    return filters.map(f => wrapFilter(f, options));
}

export function wrapFilter(filter: UIFilterBuilder<UIFilter>, { key }: WrapFilterOptions) {
    filter.wrapper = {
        [key]: {
            $elemMatch: filter.wrapper ?? FilterWrapperMarker,
        },
    };

    if (filter.wrapFilter) {
        const wrapFilter = filter.wrapFilter;
        filter.wrapFilter = (f: StamhoofdFilter) => {
            return {
                [key]: {
                    $elemMatch: wrapFilter(f),
                },
            };
        };
    }

    // todo: test
    filter.unwrapFilter = (value) => {
        if (value && value[key]['$elemMatch']) {
            return value[key]['$elemMatch'];
        }

        return value;
    };

    return filter;
}
