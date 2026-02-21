import { StamhoofdCompareValue, StamhoofdFilter, unwrapFilter } from '@stamhoofd/structures';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterMode, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';

/**
 * Create a multiple choice filter builder with an option for true and false.
 */
export function simpleBooleanFilterFactory({ name, description, optionNames, filterIfTrue, allowCreation }: { name: string; description?: string; optionNames: {
    true: string;
    false: string;
}; filterIfTrue: StamhoofdFilter; allowCreation?: boolean; }) {
    return new MultipleChoiceFilterBuilder({
        name,
        description,
        allowCreation,
        options: [
            new MultipleChoiceUIFilterOption(optionNames.true, true),
            new MultipleChoiceUIFilterOption(optionNames.false, false),
        ],
        wrapFilter: (f: StamhoofdFilter) => {
            const choices = Array.isArray(f) ? f : [f];
            if (choices.length === 1) {
                const choice = choices[0];

                if (typeof choice === 'boolean') {
                    if (choice) {
                        return filterIfTrue;
                    }
                    return {
                        $not: filterIfTrue,
                    };
                }
            }

            return null;
        },
        unwrapFilter: (f: StamhoofdFilter): StamhoofdFilter | null => {
            for (const value of [true, false]) {
                const result = unwrapFilter(f, value ? filterIfTrue : { $not: filterIfTrue });

                if (result.match) {
                    return [value];
                }
            }

            return null;
        },

    });
}

/**
 * Create a multiple choice filter with simple logic (each option has a filter).
 */
export function simpleMultipleChoiceFilterFactory<T extends StamhoofdCompareValue>({ name, description, options, allowCreation, filterMode = MultipleChoiceUIFilterMode.And }:
{
    name: string;
    description?: string;
    filterMode: MultipleChoiceUIFilterMode;
    options: { name: string; value: T; filter: StamhoofdFilter }[];
    allowCreation?: boolean;
}) {
    const isAnd: boolean = filterMode === MultipleChoiceUIFilterMode.And;

    return new MultipleChoiceFilterBuilder({
        name,
        description,
        allowCreation,
        multipleChoiceConfiguration: { mode: filterMode },
        options: options.map(o => new MultipleChoiceUIFilterOption(o.name, o.value)),
        wrapFilter: (f: StamhoofdFilter) => {
            const choices = Array.isArray(f) ? f : [f];

            const filters: StamhoofdFilter[] = [];

            for (const choice of choices) {
                const option = options.find(o => o.value === choice);
                if (option) {
                    filters.push(option.filter);
                }
            }

            if (filters.length === 0) {
                return null;
            }

            if (filters.length === 1) {
                return filters[0];
            }

            if (isAnd) {
                return filters;
            }

            return {
                $or: filters,
            };
        },
        unwrapFilter: (f: StamhoofdFilter): StamhoofdFilter | null => {
            for (const option of options) {
                const result = unwrapFilter(f, option.filter);

                if (result.match) {
                    return [option.value];
                }
            }

            return null;
        },

    });
}
