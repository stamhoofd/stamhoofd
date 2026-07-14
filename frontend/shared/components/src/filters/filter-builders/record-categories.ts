import { DateFilterBuilder } from '#filters/DateUIFilter.ts';
import { NumberFilterFormat } from '#filters/NumberFilterFormat.ts';
import type { RecordCategory } from '@stamhoofd/structures';
import { FilterWrapperMarker, RecordType } from '@stamhoofd/structures';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder } from '../NumberUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilter, UIFilterBuilder } from '../UIFilter';

export function getFilterBuildersForRecordCategories(categories: RecordCategory[], prefix = '', options?: { includeNullable?: boolean }) {
    const all: UIFilterBuilder<UIFilter>[] = [];

    for (const category of categories) {
        const allForCategory: UIFilterBuilder<UIFilter>[] = [];
        const categoryPrefix = category.name + ' → ';

        for (const record of category.records) {
            switch (record.type) {
                case RecordType.Text:
                case RecordType.Textarea:
                case RecordType.Email:
                case RecordType.Phone:
                {
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
                    break;
                }
                case RecordType.Integer:
                case RecordType.Price: {
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
                    break;
                }
                case RecordType.Checkbox: {
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
                    break;
                }
                case RecordType.ChooseOne: {
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
                            additionalUnwrappers: [
                                { recordAnswers: {
                                    [record.id]: {
                                        selectedChoices: {
                                            id: {
                                                $in: FilterWrapperMarker,
                                            },
                                        },
                                    },
                                } },
                            ],
                        }),
                    );
                    break;
                }
                case RecordType.MultipleChoice: {
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
                    break;
                }
                case RecordType.Date: {
                    allForCategory.push(
                        new DateFilterBuilder({
                            name: prefix + categoryPrefix + record.name,
                            key: 'dateValue',
                            wrapper: {
                                recordAnswers: {
                                    [record.id]: FilterWrapperMarker,
                                },
                            },
                        }),
                    );
                    break;
                }
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
