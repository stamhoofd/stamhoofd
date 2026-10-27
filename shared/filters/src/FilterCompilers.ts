import { SimpleError } from '@common/errors';
import type { StamhoofdCompareValue, StamhoofdFilter, StamhoofdMagicFilter, StamhoofdMagicRelationFilter } from './StamhoofdFilter.js';

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

export type FilterCompiler<Runner> = (filter: StamhoofdFilter, parentCompiler: FilterCompiler<Runner>, key: string) => Runner | undefined;
export type RequiredFilterCompiler<Runner> = (filter: StamhoofdFilter, parentCompiler: FilterCompiler<Runner>) => Runner;

/** Registry of exact filter keys and nested namespaces, without inherited keys. */
export type FilterDefinitions<Runner> = Map<string, FilterCompiler<Runner> | FilterDefinitions<Runner>>;

/**
 * @deprecated
 */
export type FilterCompilerSelector<Runner> = FilterCompiler<Runner>;

export const filterDefinitionsToSelector = filterDefinitionsToCompiler;

/**
 * Exact registrations take precedence over dotted namespaces and the `*` fallback.
 * The fallback only handles non-operator keys without a dot; a compiler returning
 * undefined remains an exact match and does not trigger fallback resolution.
 */
export function filterDefinitionsToCompiler<Runner>(definitions: FilterDefinitions<Runner>): FilterCompiler<Runner> {
    return (filter: StamhoofdFilter, parentCompiler: FilterCompiler<Runner>, key: string) => {
        let k = definitions.get(key);

        if (!definitions.has(key)) {
            const dotIndex = key.indexOf('.');
            if (dotIndex !== -1) {
                // todo: first search for first match + adjust filter
                const firstKey = key.substring(0, dotIndex);
                const k = definitions.get(firstKey);
                if (k === undefined) {
                    throw new SimpleError({
                        code: 'unknown_filter',
                        message: 'Unknown filter ' + key,
                    });
                }
                const subKey = key.substring(dotIndex + 1);

                if (typeof k === 'function') {
                    return k({ [subKey]: filter }, parentCompiler, firstKey);
                }

                const subCompiler = filterDefinitionsToCompiler(k);
                return subCompiler(filter, subCompiler, subKey);
            }

            if (definitions.has('*') && !key.startsWith('$')) {
                k = definitions.get('*');
            }
        }

        if (typeof k === 'function') {
            return k(filter, parentCompiler, key);
        }
        if (k instanceof Map) {
            // Create a namespace compiler
            const subCompiler = filterDefinitionsToCompiler(k);
            return subCompiler(filter, subCompiler, '$and');
        }
        return undefined;
    };
}

export function compileFilter<Runner>(filter: StamhoofdFilter, parentCompiler: FilterCompiler<Runner>): Runner[] {
    if (filter === undefined) {
        return [];
    }

    const runners: Runner[] = [];

    if (Array.isArray(filter)) {
        // we combine these filters and and children
        for (const subFilter of filter) {
            const runner = parentCompiler(subFilter, parentCompiler, '$and');
            if (runner === undefined) {
                throw new SimpleError({
                    code: 'unknown_filter',
                    message: 'Unknown filter $and',
                });
            }
            runners.push(runner);
        }
    } else {
        const f = wrapPlainFilter(filter);
        for (const key of Object.keys(f)) {
            const subFilter = f[key] as StamhoofdFilter;
            const runner = parentCompiler(subFilter, parentCompiler, key);
            if (runner === undefined) {
                throw new SimpleError({
                    code: 'unknown_filter',
                    message: 'Unknown filter ' + key,
                });
            }
            runners.push(
                runner,
            );
        }
    }
    return runners;
}

export function getMagicValue(value: StamhoofdMagicFilter): StamhoofdCompareValue {
    const specialValue = value['$'];
    switch (specialValue) {
        case '$now': return value;
        case '$rel': return getMagicRelationValue(value);
        default: throw new SimpleError({
            code: 'unknown_filter',
            message: 'Unknown magic filter ' + specialValue,
        });
    }
}

export function isMagicFilter(value: any): value is StamhoofdMagicFilter {
    if (value === null) {
        return false;
    }

    if (typeof value === 'object' && '$' in value) {
        return true;
    }

    return false;
}

export function isMagicRelationFilter(value: any): value is StamhoofdMagicRelationFilter {
    if (!isMagicFilter(value)) {
        return false;
    }

    const specialValue = value['$'];
    return specialValue === '$rel';
}

export function getMagicRelationValue(value: StamhoofdMagicRelationFilter): StamhoofdCompareValue {
    return assertFilterCompareValue(value['value']);
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

    if (isMagicFilter(val)) {
        return getMagicValue(val);
    }

    console.error('Invalid compare value. Expected a string, number, boolean, date or null.', val);
    throw new Error('Invalid compare value. Expected a string, number, boolean, date or null.');
}
