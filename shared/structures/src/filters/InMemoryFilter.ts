import { StringCompare } from '@stamhoofd/utility';

import { StamhoofdCompareValue, StamhoofdFilter } from './StamhoofdFilter.js';

export type InMemoryFilterRunner = (object: any) => boolean;

export type InMemoryFilterCompiler = (filter: StamhoofdFilter, compilers: InMemoryFilterCompilerSelector) => InMemoryFilterRunner;
export type InMemoryFilterDefinitions = Record<string, InMemoryFilterCompiler>;
export type InMemoryFilterCompilerSelector = (key: string, filter: StamhoofdFilter) => InMemoryFilterCompiler | undefined;

function filterDefinitionsToSelector(definitions: InMemoryFilterDefinitions): InMemoryFilterCompilerSelector {
    return (key: string) => {
        return definitions[key];
    };
}

function $andInMemoryFilterCompiler(filter: StamhoofdFilter, filters: InMemoryFilterCompilerSelector): InMemoryFilterRunner {
    const runners = compileInMemoryFilter(filter, filters);
    return (object) => {
        for (const runner of runners) {
            if (!runner(object)) {
                return false;
            }
        }
        return true;
    };
}

function $orInMemoryFilterCompiler(filter: StamhoofdFilter, filters: InMemoryFilterCompilerSelector): InMemoryFilterRunner {
    const runners = compileInMemoryFilter(filter, filters);
    return (object) => {
        for (const runner of runners) {
            if (runner(object)) {
                return true;
            }
        }
        return false;
    };
}

function $notInMemoryFilterCompiler(filter: StamhoofdFilter, filters: InMemoryFilterCompilerSelector): InMemoryFilterRunner {
    const andRunner = $andInMemoryFilterCompiler(filter, filters);
    return (object) => {
        return !andRunner(object);
    };
}

function $lessThanInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        const a = normalizeValue(guardFilterCompareValue(val));
        const b = normalizeValue(guardFilterCompareValue(filter));
        if (a === null || b === null) {
            return a !== null && b === null;
        }
        return a < b;
    };
}

function $greaterThanInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        const a = normalizeValue(guardFilterCompareValue(val));
        const b = normalizeValue(guardFilterCompareValue(filter));
        if (a === null || b === null) {
            return a === null && b !== null;
        }
        return a > b;
    };
}

function $equalsInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        const b = normalizeValue(guardFilterCompareValue(filter));

        if (Array.isArray(val)) {
            // To match backend logic where these things are required for optimizations
            // + also match MongoDB behavior

            for (const v of val) {
                const a = normalizeValue(guardFilterCompareValue(v));

                if (a === b) {
                    return true;
                }
            }
            return false;
        }

        const a = normalizeValue(guardFilterCompareValue(val));
        return a === b;
    };
}

function invertFilterCompiler(compiler: InMemoryFilterCompiler): InMemoryFilterCompiler {
    return (filter: StamhoofdFilter, compilers: InMemoryFilterCompilerSelector) => {
        const runner = compiler(filter, compilers);
        return (val) => {
            return !runner(val);
        };
    };
}

function $containsInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        const a = normalizeValue(guardFilterCompareValue(val));
        const needle = normalizeValue(guardFilterCompareValue(filter));

        if (typeof a !== 'string' || typeof needle !== 'string') {
            return false;
        }
        return StringCompare.contains(a, needle);
    };
}

function $inInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        if (val === undefined) {
            // Using $in on a property that does not exist should always return false
            return false;
        }

        if (!Array.isArray(filter)) {
            throw new Error('Invalid filter: expected array as value for $in filter');
        }

        if (Array.isArray(val)) {
            // To match backend logic (JSON_OVERLAPS in MySQL) where these things are required for optimizations
            // + also match MongoDB behavior

            for (const v of val) {
                const a = normalizeValue(guardFilterCompareValue(v));

                for (const element of filter) {
                    const b = normalizeValue(guardFilterCompareValue(element));
                    if (a === b) {
                        return true;
                    }
                }
            }
            return false;
        }

        const a = normalizeValue(guardFilterCompareValue(val));

        for (const element of filter) {
            const b = normalizeValue(guardFilterCompareValue(element));
            if (a === b) {
                return true;
            }
        }

        return false;
    };
}

function $elemMatchInMemoryFilterCompiler(filter: StamhoofdFilter, compilers: InMemoryFilterCompilerSelector): InMemoryFilterRunner {
    const runner = $andInMemoryFilterCompiler(filter, compilers);
    return (val) => {
        if (val === undefined) {
            // Using $elemMatch on a property that does not exist should always return false
            return false;
        }

        if (!Array.isArray(val)) {
            throw new Error('Invalid filter: expected array as value for $elemMatch filter');
        }

        for (const o of val) {
            // Check if individual item matches the filter
            if (runner(o)) {
                return true;
            }
        }

        return false;
    };
}

function $lengthInMemoryFilterCompiler(filter: StamhoofdFilter, compilers: InMemoryFilterCompilerSelector): InMemoryFilterRunner {
    const runner = $andInMemoryFilterCompiler(filter, compilers);

    return (val) => {
        if (typeof val === 'string' || Array.isArray(val)) {
            return runner(val.length);
        }

        throw new Error('Invalid filter: expected string or array as value for $length filter');
    };
}

function objectPathValue(object: any, path: string[]) {
    if (path.length === 0) {
        return object;
    }

    const nextSearched = path[0];
    if (object instanceof Map) {
        if (object.has(nextSearched)) {
            return objectPathValue(object.get(nextSearched), path.slice(1));
        }
        return undefined;
    }

    if (typeof object !== 'object' || object === null) {
        return undefined;
    }

    if (nextSearched in object) {
        return objectPathValue(object[nextSearched], path.slice(1));
    }
}

function guardFilterCompareValue(val: any): StamhoofdCompareValue {
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

function normalizeValue(val: StamhoofdCompareValue): string | number | null {
    if (val instanceof Date) {
        return val.getTime();
    }

    if (typeof val === 'string') {
        return val.toLocaleLowerCase();
    }

    if (typeof val === 'boolean') {
        return val === true ? 1 : 0;
    }

    if (val === null) {
        return null;
    }

    if (typeof val === 'object' && '$' in val) {
        const specialValue = val['$'];

        switch (specialValue) {
            case '$now':
                return normalizeValue(new Date());
            default:
                throw new Error('Unsupported magic value ' + specialValue);
        }
    }

    return val;
}

function wrapPlainFilter(filter: StamhoofdFilter): Exclude<StamhoofdFilter, StamhoofdCompareValue> {
    if (typeof filter === 'string' || typeof filter === 'number' || typeof filter === 'boolean' || filter === null || filter === undefined || filter instanceof Date) {
        return {
            $eq: filter,
        };
    }
    return filter;
}

export function createInMemoryFilterCompiler(path: string | string[], overrideFilterDefinitions?: InMemoryFilterDefinitions | InMemoryFilterCompilerSelector): InMemoryFilterCompiler {
    const splitted = Array.isArray(path) ? path : path.split('.');

    return (filter: StamhoofdFilter, compilers: InMemoryFilterCompilerSelector) => {
        const runner = $andInMemoryFilterCompiler(filter, overrideFilterDefinitions ? (typeof overrideFilterDefinitions === 'function' ? overrideFilterDefinitions : filterDefinitionsToSelector(overrideFilterDefinitions)) : compilers);

        return (object) => {
            const value = objectPathValue(object, splitted);
            if (value === undefined) {
                // Cannot filter on property that does not exists
                // (no need to continue here on the filters as these will throw on an undefined value)
                return false;
            }
            return runner(value);
        };
    };
}

export function createInMemoryWildcardCompilerSelector(overrideFilterDefinitions?: InMemoryFilterDefinitions | InMemoryFilterCompilerSelector): InMemoryFilterCompilerSelector {
    return (key: string) => {
        // Every key will match on this compiler
        return createInMemoryFilterCompiler(key, overrideFilterDefinitions);
    };
}

export function createInMemoryFilterCompilerFromCompositePath(paths: string[], separator = ' '): InMemoryFilterCompiler {
    const splittedPaths = paths.map(path => path.split('.'));

    return (filter: StamhoofdFilter, compilers: InMemoryFilterCompilerSelector) => {
        const runner = $andInMemoryFilterCompiler(filter, compilers);

        return (object) => {
            const value = splittedPaths.map(splitted => objectPathValue(object, splitted)).join(separator);
            return runner(value);
        };
    };
}

export const baseInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    $and: $andInMemoryFilterCompiler,
    $or: $orInMemoryFilterCompiler,
    $not: $notInMemoryFilterCompiler,
    $eq: $equalsInMemoryFilterCompiler,
    $neq: invertFilterCompiler($equalsInMemoryFilterCompiler),
    $lt: $lessThanInMemoryFilterCompiler,
    $gt: $greaterThanInMemoryFilterCompiler,
    $lte: invertFilterCompiler($greaterThanInMemoryFilterCompiler),
    $gte: invertFilterCompiler($lessThanInMemoryFilterCompiler),
    $in: $inInMemoryFilterCompiler,
    $elemMatch: $elemMatchInMemoryFilterCompiler,
    $contains: $containsInMemoryFilterCompiler,
    $length: $lengthInMemoryFilterCompiler,
};

function compileInMemoryFilter(filter: StamhoofdFilter, getCompilerForFilter: InMemoryFilterCompilerSelector): InMemoryFilterRunner[] {
    if (filter === undefined) {
        return [];
    }

    const runners: InMemoryFilterRunner[] = [];

    for (const f2 of (Array.isArray(filter) ? filter : [filter])) {
        const f = wrapPlainFilter(f2);
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

export const compileToInMemoryFilter = (filter: StamhoofdFilter, filters: InMemoryFilterDefinitions) => {
    if (filter === null) {
        return () => true;
    }
    return $andInMemoryFilterCompiler(filter, filterDefinitionsToSelector(filters));
};
