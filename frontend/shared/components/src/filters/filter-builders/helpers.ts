import { StamhoofdFilter, unwrapFilter } from '@stamhoofd/structures';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';

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
