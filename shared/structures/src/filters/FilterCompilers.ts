import { SimpleError } from '@simonbackx/simple-errors';
import { StamhoofdCompareValue, StamhoofdFilter } from './StamhoofdFilter.js';

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

export type FilterDefinitions<Runner> = {
    [P in string]: FilterCompiler<Runner> | FilterDefinitions<Runner>;
};

// Record<string, FilterCompiler<Runner> | FilterDefinitions<Runner>>;
/**
 * @deprecated
 */
export type FilterCompilerSelector<Runner> = FilterCompiler<Runner>;

export const filterDefinitionsToSelector = filterDefinitionsToCompiler;

export function filterDefinitionsToCompiler<Runner>(definitions: FilterDefinitions<Runner>): FilterCompiler<Runner> {
    return (filter: StamhoofdFilter, parentCompiler: FilterCompiler<Runner>, key: string) => {
        let k = definitions[key] as FilterCompiler<Runner> | FilterDefinitions<Runner> | undefined;

        if (!k) {
            const dotIndex = key.indexOf('.');
            if (dotIndex !== -1) {
                // todo: first search for first match + adjust filter
                const firstKey = key.substring(0, dotIndex);
                const k = definitions[firstKey];
                if (!k) {
                    throw new SimpleError({
                        code: 'unknown_filter',
                        message: 'Unknown filter ' + key,
                        human: $t('Deze filter wordt niet ondersteund of er ging iets fout met deze filter'),
                    });
                }
                const subKey = key.substring(dotIndex + 1);

                if (typeof k === 'function') {
                    return k({ [subKey]: filter }, parentCompiler, firstKey);
                }

                const subCompiler = filterDefinitionsToCompiler(k);
                return subCompiler(filter, subCompiler, subKey);
            }

            if (definitions['*'] && !key.startsWith('$')) {
                k = definitions['*'];
            }
        }

        if (typeof k === 'function') {
            return k(filter, parentCompiler, key);
        }
        if (typeof k === 'object') {
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
                    human: $t('Deze filter wordt niet ondersteund of er ging iets fout met deze filter'),
                });
            }
            runners.push(runner);
        }
    }
    else {
        const f = wrapPlainFilter(filter);
        for (const key of Object.keys(f)) {
            const subFilter = f[key] as StamhoofdFilter;
            const runner = parentCompiler(subFilter, parentCompiler, key);
            if (runner === undefined) {
                throw new SimpleError({
                    code: 'unknown_filter',
                    message: 'Unknown filter ' + key,
                    human: $t('Deze filter wordt niet ondersteund of er ging iets fout met deze filter'),
                });
            }
            runners.push(
                runner,
            );
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

    console.error('Invalid compare value. Expected a string, number, boolean, date or null.', val);
    throw new Error('Invalid compare value. Expected a string, number, boolean, date or null.');
}
