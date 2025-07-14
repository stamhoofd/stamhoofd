import { Version } from '../Version.js';
import { StamhoofdFilterDecoder } from './FilteredRequest.js';
import { AssertSortList, SortItemDirection, SortList } from './SortList.js';

export type StamhoofdAndFilter<T = StamhoofdCompareValue> = {
    $and: StamhoofdFilter<T>;
};

export type StamhoofdOrFilter<T = StamhoofdCompareValue> = {
    $or: StamhoofdFilter<T>;
};

export type StamhoofdNotFilter<T = StamhoofdCompareValue> = {
    $not: StamhoofdFilter<T>;
};

/**
 * Magic values help with storage of filters and maintaining their meaning
 */
export type StamhoofdMagicValues = '$now';
export type StamhoofdCompareValue = string | number | Date | null | boolean | { $: StamhoofdMagicValues };
export const FilterWrapperMarker = Symbol('FilterWrapperMarker');
export type WrapperFilter = StamhoofdFilter<StamhoofdCompareValue | typeof FilterWrapperMarker>;

export type StamhoofdKeyFilterValue<T = StamhoofdCompareValue> =
    { $eq: T }
    | { $in: T[] }
    | { $neq: T }
    | { $gt: T }
    | { $lt: T }
    | { $contains: string }
    | { $length: StamhoofdFilter<T> }
    | { $elemMatch: StamhoofdFilter<T> }
    | T;

export type StamhoofdKeyFilter<T = StamhoofdCompareValue> = {
    [k in string]: StamhoofdFilter<T>
};

export type StamhoofdFilter<T = StamhoofdCompareValue> = StamhoofdAndFilter<T> | StamhoofdOrFilter<T> | StamhoofdNotFilter<T> | StamhoofdKeyFilterValue<T> | StamhoofdKeyFilter<T> | StamhoofdFilter<T>[];

export function isEmptyFilter(filter: StamhoofdFilter) {
    if (filter === null) {
        return true;
    }

    if (typeof filter === 'object' && filter !== null) {
        return Object.keys(filter).length === 0;
    }

    if (Array.isArray(filter)) {
        return filter.length === 0;
    }

    return false;
}

export function mergeFilters(filters: (StamhoofdFilter | null)[], type: '$and' | '$or' = '$and'): StamhoofdFilter | null {
    const filteredFilters = filters.filter(f => !isEmptyFilter(f)).flatMap(f => Array.isArray(f) ? (type === '$and' ? f : [{ $and: f }]) : [f]);

    if (filteredFilters.length === 0) {
        return null;
    }

    if (filteredFilters.length === 1) {
        return filteredFilters[0];
    }

    return {
        [type]: filteredFilters,
    };
}

export function assertSort(list: SortList, assert: AssertSortList): SortList {
    for (const a of assert) {
        if (list.find(l => l.key === a.key)) {
            continue;
        }

        // Always add id as an extra sort key for sorters that are not unique
        list = [...list, { key: a.key, order: a.order ?? list[0]?.order ?? SortItemDirection.ASC }];
    }

    return list;
}

export function isEqualFilter(a: StamhoofdFilter | null, b: StamhoofdFilter | null) {
    if (a === null) {
        return b === null;
    }

    if (b === null) {
        return false;
    }

    return JSON.stringify(StamhoofdFilterDecoder.encode(a, { version: Version })) === JSON.stringify(StamhoofdFilterDecoder.encode(b, { version: Version }));
}

export function wrapFilter(filter: StamhoofdFilter, wrap: WrapperFilter): StamhoofdFilter {
    // Replace the FilterWrapperMarker symbol in wrap with filter
    if (wrap === FilterWrapperMarker) {
        return filter;
    }

    if (Array.isArray(wrap)) {
        return wrap.map(w => wrapFilter(filter, w));
    }

    if (typeof wrap === 'object' && wrap !== null) {
        const o = {};
        for (const key in wrap) {
            (o as any)[key] = wrapFilter(filter, (wrap as any)[key] as WrapperFilter);
        }
        return o;
    }

    return wrap;
}

/**
 * Essentially, this checks if filter and wrap are the same, but ignoring comparison if wrap is FilterWrapperMarker
 * If multiple FilterWrapperMarker are used, their value should be the same - otherwise undefined is returned
 * Returns the filter at FilterWrapperMarker if it is found
 * If no FilterWrapperMarker is found, the filter is returned if it is the same as wrap
 */
export function unwrapFilter(filter: StamhoofdFilter, wrap: WrapperFilter): { match: boolean; markerValue?: StamhoofdFilter | undefined; leftOver?: StamhoofdFilter } {
    // Replace the FilterWrapperMarker symbol in wrap with filter
    if (wrap === FilterWrapperMarker) {
        return {
            match: true,
            markerValue: filter,
        };
    }

    if (Array.isArray(wrap)) {
        if (!Array.isArray(filter)) {
            return {
                match: false,
            };
        }

        if (filter.length !== wrap.length) {
            return {
                match: false,
            };
        }

        const remaining = filter.slice();
        let pendingMarkerValue: StamhoofdFilter | undefined = undefined;

        // Order should not matter in an Array
        for (const item of wrap) {
            // Check if we find a match
            if (item === FilterWrapperMarker) {
                // Usage like this is dangerous and unpredictable
                console.warn('FilterWrapperMarker in array is not supported as this requires checking in any possible permutation of the array.');
                return {
                    match: false,
                };
            }

            let found = false;
            for (let i = 0; i < remaining.length; i++) {
                const same = unwrapFilter(remaining[i], item);

                if (same.match && !same.leftOver) {
                    if (same.markerValue) {
                        if (pendingMarkerValue !== undefined) {
                            // Check if equal
                            const { match, leftOver } = unwrapFilter(pendingMarkerValue, same.markerValue);

                            if (!match || leftOver) {
                                // Pattern did match, but multiple marker values with different values
                                return {
                                    match: false,
                                };
                            }
                        }

                        pendingMarkerValue = same.markerValue;
                    }

                    remaining.splice(i, 1);
                    found = true;
                    break;
                }
            }

            if (!found) {
                return {
                    match: false,
                };
            }
        }

        if (remaining.length > 0) {
            return {
                match: false,
            };
        }

        return {
            match: true,
            markerValue: pendingMarkerValue,
        };
    }

    if (wrap instanceof Date) {
        if (filter instanceof Date) {
            return {
                match: filter.getTime() === wrap.getTime(),
            };
        }

        return {
            match: false,
        };
    }

    if (typeof wrap === 'object' && wrap !== null) {
        if (typeof filter !== 'object' || filter === null) {
            // Not the same
            return {
                match: false,
            };
        }

        let pendingMarkerValue: StamhoofdFilter | undefined = undefined;
        for (const key in wrap) {
            const filterValue = (filter)[key] as StamhoofdFilter;

            if (filterValue === undefined) {
                // Required key not found
                return {
                    match: false,
                };
            }

            const wrapValue = wrap[key] as WrapperFilter;

            const same = unwrapFilter(filterValue, wrapValue);

            if (!same.match || same.leftOver) {
                // Not matching
                return {
                    match: false,
                };
            }

            // We have a match
            if (same.markerValue) {
                if (pendingMarkerValue !== undefined) {
                    // Check if equal
                    const { match, leftOver } = unwrapFilter(pendingMarkerValue, same.markerValue);

                    if (!match || leftOver) {
                        // Pattern did match, but multiple marker values with different values
                        return {
                            match: false,
                        };
                    }
                }

                pendingMarkerValue = same.markerValue;
            }
        }

        // We have a match
        const leftOverKeys = Object.keys(filter).filter(k => !(k in wrap));
        const leftOver = {};
        for (const key of leftOverKeys) {
            (leftOver as any)[key] = (filter as any)[key];
        }

        return {
            match: true,
            markerValue: pendingMarkerValue,
            leftOver: leftOverKeys.length ? leftOver : undefined,
        };
    }

    // Only scalar values at this point
    // No marker found
    if (filter == wrap) {
        return {
            match: true,
            // No marker value
        };
    }
    return {
        match: false,
    };
}

export function unwrapFilterByPath(filter: StamhoofdFilter, keyPath: (string | number)[]): StamhoofdFilter | null {
    if (keyPath.length === 0) {
        return filter;
    }
    const first = keyPath[0];

    if (typeof first === 'number') {
        if (!Array.isArray(filter)) {
            return null;
        }
        if (first >= filter.length) {
            return null;
        }
        return unwrapFilterByPath((filter as any)[first] as StamhoofdFilter, keyPath.slice(1));
    }

    if (!(typeof filter === 'object')) {
        return null;
    }

    if (filter === null) {
        return null;
    }

    if (first in filter) {
        return unwrapFilterByPath((filter as any)[first] as StamhoofdFilter, keyPath.slice(1));
    }

    return null;
}
