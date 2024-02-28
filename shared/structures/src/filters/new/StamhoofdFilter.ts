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

export type StamhoofdKeyFilterValue = {$eq: StamhoofdCompareValue}|{$neq: StamhoofdCompareValue}|{$gt: StamhoofdCompareValue}|{$lt: StamhoofdCompareValue}|{$contains: string}|StamhoofdFilter;

export type StamhoofdKeyFilter = {
    [k in string]: StamhoofdKeyFilterValue
}

export type StamhoofdFilter = StamhoofdAndFilter | StamhoofdOrFilter | StamhoofdNotFilter | StamhoofdKeyFilter | StamhoofdFilter[]
