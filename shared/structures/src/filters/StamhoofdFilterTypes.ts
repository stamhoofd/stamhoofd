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
export type StamhoofdMagicValues = '$now' | '$rel';
export type StamhoofdMagicNowFilter = { $: '$now' };
export type StamhoofdMagicRelationFilter = {
    $: '$rel';
    // value to search the relation by (will often be an id)
    value: string | number | Date | null | boolean;
    // human readable name of the relation
    name: string;
    // Sometimes multiple relation types are possible. For example for filtering a registration on groupIds, but the groups can be of different types such as 'EventRegistration' or 'Membership'. The SQL filter will be the same, but in the UI these could be handled differently.
    type?: string;
};

export type StamhoofdMagicFilter = StamhoofdMagicNowFilter | StamhoofdMagicRelationFilter;
export type StamhoofdCompareValue = string | number | Date | null | boolean | StamhoofdMagicFilter;
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
