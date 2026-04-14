import type { RecordCategory } from '@stamhoofd/structures';
import { FilterWrapperMarker, RecordType } from '@stamhoofd/structures';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from '../NumberUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilter, UIFilterBuilder } from '../UIFilter';

export function getFilterBuildersForRecordCategories(categories: RecordCategory[], prefix = '', options?: { includeNullable?: boolean }) {
    const all: UIFilterBuilder<UIFilter>[] = [];

    for (const category of categories) {
        const allForCategory: UIFilterBuilder<UIFilter>[] = [];
        const categoryPrefix = category.name + ' → ';

        for (const record of category.records) {
            if (record.type === RecordType.Text || record.type === RecordType.Textarea) {
                allForCategory.push(
                    new StringFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        key: 'value',
                        wrapper: {
                            recordAnswers: {
                                [record.id]: FilterWrapperMarker,
                            },
                        },
                    }),
                );
            }

            if (record.type === RecordType.Integer || record.type === RecordType.Price) {
                allForCategory.push(
                    new NumberFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        key: 'value',
                        type: record.type === RecordType.Price ? NumberFilterFormat.Currency : NumberFilterFormat.Number,
                        wrapper: {
                            recordAnswers: {
                                [record.id]: FilterWrapperMarker,
                            },
                        },
                    }),
                );
            }

            if (record.type === RecordType.Checkbox) {
                const extra = options?.includeNullable
                    ? [new MultipleChoiceUIFilterOption($t('%1CJ'), null)]
                    : [];
                allForCategory.push(
                    new MultipleChoiceFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        options: [
                            ...extra,
                            new MultipleChoiceUIFilterOption($t('%BM'), true),
                            new MultipleChoiceUIFilterOption($t('%BN'), false),
                        ],
                        wrapper: {
                            recordAnswers: {
                                [record.id]: {
                                    selected: { $in: FilterWrapperMarker },
                                },
                            },
                        },
                    }),
                );
            }

            if (record.type === RecordType.ChooseOne) {
                const extra = options?.includeNullable
                    ? [new MultipleChoiceUIFilterOption($t('%1CJ'), null)]
                    : [];

                allForCategory.push(
                    new MultipleChoiceFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        options: [
                            ...extra,
                            ...record.choices.map(c => new MultipleChoiceUIFilterOption(c.name.toString(), c.id)),
                        ],
                        wrapper: {
                            recordAnswers: {
                                [record.id]: {
                                    selectedChoice: {
                                        id: {
                                            $in: FilterWrapperMarker,
                                        },
                                    },
                                },
                            },
                        },
                    }),
                );
            }

            if (record.type === RecordType.MultipleChoice) {
                const extra = options?.includeNullable
                    ? [new MultipleChoiceUIFilterOption($t('%1CJ'), null)]
                    : [];

                allForCategory.push(
                    new MultipleChoiceFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        options: [
                            ...extra,
                            ...record.choices.map(c => new MultipleChoiceUIFilterOption(c.name.toString(), c.id)),
                        ],
                        wrapper: {
                            recordAnswers: {
                                [record.id]: {
                                    selectedChoices: {
                                        id: {
                                            $in: FilterWrapperMarker,
                                        },
                                    },
                                },
                            },
                        },
                    }),
                );
            }
        }

        allForCategory.push(
            ...getFilterBuildersForRecordCategories(category.childCategories, prefix + categoryPrefix, options),
        );

        if (allForCategory.length > 0) {
            const group = new GroupUIFilterBuilder({
                name: category.name.toString(),
                builders: allForCategory,
            });
            allForCategory.unshift(group);
            all.push(
                group,
            );
        }
    }

    return all;
}
