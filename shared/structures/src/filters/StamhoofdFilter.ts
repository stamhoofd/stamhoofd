import { AssertSortList, SortItemDirection, SortList } from "./SortList"

export type StamhoofdAndFilter<T = StamhoofdCompareValue> = {
    $and: StamhoofdFilter<T>
}

export type StamhoofdOrFilter<T = StamhoofdCompareValue> = {
    $or: StamhoofdFilter<T>
}

export type StamhoofdNotFilter<T = StamhoofdCompareValue> = {
    $not: StamhoofdFilter<T>
}

export type StamhoofdCompareValue = string|number|Date|null|boolean

export type StamhoofdKeyFilterValue<T = StamhoofdCompareValue> = 
    {$eq: T}
    |{$in: T[]}
    |{$neq: T}
    |{$gt: T}
    |{$lt: T}
    |{$contains: string}
    |{$length: StamhoofdFilter<T>}
    |{$elemMatch: StamhoofdFilter<T>}
    |T;

export type StamhoofdKeyFilter<T = StamhoofdCompareValue> = {
    [k in string]: StamhoofdFilter<T>
}

export type StamhoofdFilter<T = StamhoofdCompareValue> = StamhoofdAndFilter<T> | StamhoofdOrFilter<T>  | StamhoofdNotFilter<T>  | StamhoofdKeyFilterValue<T>  | StamhoofdKeyFilter<T> | StamhoofdFilter<T>[]


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

export function mergeFilters(filters: (StamhoofdFilter|null)[], type: '$and' | '$or' = "$and"): StamhoofdFilter|null {
    const filteredFilters = filters.filter(f => !isEmptyFilter(f));

    if (filteredFilters.length === 0) {
        return null;
    }

    if (filteredFilters.length === 1) {
        return filteredFilters[0];
    }

    return {
        [type]: filteredFilters
    }
}

export function assertSort(list: SortList, assert: AssertSortList): SortList  {
    for (const a of assert) {
        if (list.find(l => l.key === a.key)) {
            continue;
        }
    
        // Always add id as an extra sort key for sorters that are not unique
        list = [...list, {key: a.key, order: a.order ?? list[0]?.order ?? SortItemDirection.ASC}]
    }

    return list;
}