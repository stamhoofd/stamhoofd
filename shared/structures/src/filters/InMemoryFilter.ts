import { StringCompare } from '@stamhoofd/utility';

import { assertFilterCompareValue, compileFilter, FilterCompiler, FilterCompilerSelector, FilterDefinitions, filterDefinitionsToSelector, RequiredFilterCompiler } from './FilterCompilers.js';
import { StamhoofdCompareValue, StamhoofdFilter } from './StamhoofdFilter.js';

export type InMemoryFilterRunner = (object: any) => boolean;

export type InMemoryRequiredFilterCompiler = RequiredFilterCompiler<InMemoryFilterRunner>;
export type InMemoryFilterCompiler = FilterCompiler<InMemoryFilterRunner>;
export type InMemoryFilterDefinitions = FilterDefinitions<InMemoryFilterRunner>;
export type InMemoryFilterCompilerSelector = FilterCompilerSelector<InMemoryFilterRunner>;

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
        const a = normalizeValue(assertFilterCompareValue(val));
        const b = normalizeValue(assertFilterCompareValue(filter));
        if (a === null || b === null) {
            return a !== null && b === null;
        }
        return a < b;
    };
}

function $greaterThanInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        const a = normalizeValue(assertFilterCompareValue(val));
        const b = normalizeValue(assertFilterCompareValue(filter));
        if (a === null || b === null) {
            return a === null && b !== null;
        }
        return a > b;
    };
}

function $equalsInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        const b = normalizeValue(assertFilterCompareValue(filter));

        if (Array.isArray(val)) {
            // To match backend logic where these things are required for optimizations
            // + also match MongoDB behavior

            for (const v of val) {
                const a = normalizeValue(assertFilterCompareValue(v));

                if (a === b) {
                    return true;
                }
            }
            return false;
        }

        const a = normalizeValue(assertFilterCompareValue(val));
        return a === b;
    };
}

function invertFilterCompiler(compiler: InMemoryRequiredFilterCompiler): InMemoryRequiredFilterCompiler {
    return (filter: StamhoofdFilter, compilers: InMemoryFilterCompilerSelector) => {
        const runner = compiler(filter, compilers);
        return (val) => {
            return !runner(val);
        };
    };
}

function $containsInMemoryFilterCompiler(filter: StamhoofdFilter): InMemoryFilterRunner {
    return (val) => {
        const a = normalizeValue(assertFilterCompareValue(val));
        const needle = normalizeValue(assertFilterCompareValue(filter));

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
                const a = normalizeValue(assertFilterCompareValue(v));

                for (const element of filter) {
                    const b = normalizeValue(assertFilterCompareValue(element));
                    if (a === b) {
                        return true;
                    }
                }
            }
            return false;
        }

        const a = normalizeValue(assertFilterCompareValue(val));

        for (const element of filter) {
            const b = normalizeValue(assertFilterCompareValue(element));
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

        // This mimics SQL behaviour where you can add wildcards in paths, which expands to a JSONArray
        if (nextSearched === '*') {
            // Create an array with all the values of the map, following the path for each individual value
            const array: any[] = [];
            for (const value of object.values()) {
                array.push(objectPathValue(value, path.slice(1)));
            }
            return array;
        }
        return undefined;
    }

    if (typeof object !== 'object' || object === null) {
        return undefined;
    }

    if (nextSearched in object) {
        return objectPathValue(object[nextSearched], path.slice(1));
    }

    // This mimics SQL behaviour where you can add wildcards in paths, which expands to a JSONArray
    if (nextSearched === '*' && Array.isArray(object)) {
        // Create an array with all the values of the map, following the path for each individual value
        const array: any[] = [];
        for (const value of object) {
            array.push(objectPathValue(value, path.slice(1)));
        }
        return array;
    }
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

export function createInMemoryFilterCompiler(path: string | string[], overrideFilterDefinitions?: InMemoryFilterDefinitions | InMemoryFilterCompilerSelector): InMemoryFilterCompiler {
    const splitted = Array.isArray(path) ? path : path.split('.');

    return (filter: StamhoofdFilter, compilers: InMemoryFilterCompilerSelector) => {
        const runner = $andInMemoryFilterCompiler(filter, overrideFilterDefinitions ? (typeof overrideFilterDefinitions === 'function' ? overrideFilterDefinitions : filterDefinitionsToSelector(overrideFilterDefinitions)) : filterDefinitionsToSelector(baseInMemoryFilterCompilers));

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
    return (filter, parentCompiler, key: string) => {
        // Every key will match on this compiler
        const compiler = createInMemoryFilterCompiler(key, overrideFilterDefinitions);
        return compiler(filter, compiler, key);
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

const compileInMemoryFilter = compileFilter<InMemoryFilterRunner>;

export const compileToInMemoryFilter = (filter: StamhoofdFilter, filters: InMemoryFilterDefinitions) => {
    if (filter === null) {
        return () => true;
    }
    return $andInMemoryFilterCompiler(filter, filterDefinitionsToSelector(filters));
};
