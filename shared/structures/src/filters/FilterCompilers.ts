import { StamhoofdCompareValue, StamhoofdFilter } from './StamhoofdFilter';

function wrapPlainFilter(filter: StamhoofdFilter): Exclude<StamhoofdFilter, StamhoofdCompareValue> {
    if (typeof filter === 'string' || typeof filter === 'number' || typeof filter === 'boolean' || filter === null || filter === undefined || filter instanceof Date) {
        return {
            $eq: filter,
        };
    }

    // Magic values
    if (typeof filter === 'object' && '$' in filter) {
        return {
            $eq: filter,
        };
    }

    return filter;
}

export type FilterCompiler<Runner> = (filter: StamhoofdFilter, compilers: FilterCompilerSelector<Runner>) => Runner;
export type FilterDefinitions<Runner> = Record<string, FilterCompiler<Runner>>;
export type FilterCompilerSelector<Runner> = (key: string, filter: StamhoofdFilter) => FilterCompiler<Runner> | undefined;

export function compileFilter<Runner>(filter: StamhoofdFilter, getCompilerForFilter: FilterCompilerSelector<Runner>): Runner[] {
    if (filter === undefined) {
        return [];
    }

    const runners: Runner[] = [];

    if (Array.isArray(filter)) {
        // we combine these filters and and children
        for (const f of filter) {
            const subRunners = compileFilter({ $and: f }, getCompilerForFilter);
            runners.push(...subRunners);
        }
    }
    else {
        const f = wrapPlainFilter(filter);
        for (const key of Object.keys(f)) {
            const subFilter = f[key] as StamhoofdFilter;
            const filterCompiler = getCompilerForFilter(key, subFilter);
            if (!filterCompiler) {
                throw new Error('Unsupported filter ' + key);
            }

            const s = filterCompiler(subFilter, getCompilerForFilter);
            if (s === undefined || s === null) {
                throw new Error('Unsupported filter value for ' + key);
            }
            runners.push(s);
        }
    }
    return runners;
}

/**
 * Asserts val is StamhoofdCompareValue
 */
export function assertFilterCompareValue(val: any): StamhoofdCompareValue {
    if (val instanceof Date) {
        return val;
    }

    if (typeof val === 'string') {
        return val;
    }

    if (typeof val === 'number') {
        return val;
    }

    if (typeof val === 'boolean') {
        return val;
    }

    if (val === null) {
        return null;
    }

    if (typeof val === 'object' && '$' in val) {
        if (val['$'] === '$now') {
            return val;
        }
    }

    throw new Error('Invalid compare value. Expected a string, number, boolean, date or null.');
}
