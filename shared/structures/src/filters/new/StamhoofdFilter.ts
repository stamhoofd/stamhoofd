export type StamhoofdAndFilter = {
    $and: StamhoofdFilter
}

export type StamhoofdOrFilter = {
    $or: StamhoofdFilter
}

export type StamhoofdNotFilter = {
    $not: StamhoofdFilter
}

export type StamhoofdCompareValue = string|number|Date|null|boolean

export type StamhoofdKeyFilterValue = 
    {$eq: StamhoofdCompareValue}
    |{$in: StamhoofdCompareValue[]}
    |{$neq: StamhoofdCompareValue}
    |{$gt: StamhoofdCompareValue}
    |{$lt: StamhoofdCompareValue}
    |{$contains: string}
    |{$length: StamhoofdFilter}
    |StamhoofdCompareValue;

export type StamhoofdKeyFilter = {
    [k in string]: StamhoofdFilter
}

export type StamhoofdFilter = StamhoofdAndFilter | StamhoofdOrFilter | StamhoofdNotFilter | StamhoofdKeyFilterValue | StamhoofdKeyFilter | StamhoofdFilter[]


export function isEmptyFilter(filter: StamhoofdFilter) {
    if (typeof filter === 'object' && filter !== null) {
        return Object.keys(filter).length === 0;
    }

    if (Array.isArray(filter)) {
        return filter.length === 0;
    }
    
    return false;
}
