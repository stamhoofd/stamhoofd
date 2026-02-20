import { StamhoofdFilter, unwrapFilter } from '@stamhoofd/structures';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';

/**
 * Create a multiple choice filter builder with an option for true and false.
 */
export function simpleBooleanFilterFactory({ name, wrapChoice, description, allowCreation, optionNames }: { name: string; wrapChoice: (choice: boolean) => StamhoofdFilter; description?: string; allowCreation?: boolean; optionNames: {
    true: string;
    false: string;
}; }) {
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
                    return wrapChoice(choice);
                }
            }

            return null;
        },
        unwrapFilter: (f: StamhoofdFilter): StamhoofdFilter | null => {
            for (const value of [true, false]) {
                const result = unwrapFilter(f, wrapChoice(value));

                if (result.match) {
                    return [value];
                }
            }

            return null;
        },

    });
}
