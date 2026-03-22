import type { StamhoofdFilter, User } from '@stamhoofd/structures';
import { FilterWrapperMarker, SetupStepType } from '@stamhoofd/structures';
import { usePlatform } from '../../hooks';
import { getOrganizationCompanyFilterBuilders } from '../filterBuilders';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterMode, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilterBuilders } from '../UIFilter';

const getOrganizationMemberUIFilterBuilders: () => UIFilterBuilders = () => {
    const builders: UIFilterBuilders = [
        new StringFilterBuilder({
            name: $t(`%Gq`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`%1MT`),
            key: 'firstName',
        }),
        new StringFilterBuilder({
            name: $t(`%1MU`),
            key: 'lastName',
        }),
        new StringFilterBuilder({
            name: $t(`%1FK`),
            key: 'email',
        }),
    ];

    return builders;
};

export function useGetOrganizationUIFilterBuilders() {
    const platform = usePlatform();

    const setupStepFilterNameMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('%7D'),
        [SetupStepType.Companies]: $t('%6b'),
        [SetupStepType.Groups]: $t('%P4'),
        [SetupStepType.Premises]: $t('%6c'),
        [SetupStepType.Emails]: $t('%vG'),
        [SetupStepType.Payment]: $t('%O7'),
        [SetupStepType.Registrations]: $t('%1EI'),
    };

    const getOrganizationUIFilterBuilders = (user: User | null) => {
        const all = [
            new StringFilterBuilder({
                name: $t(`%Gq`),
                key: 'name',
            }),

            new StringFilterBuilder({
                name: $t(`%CQ`),
                key: 'city',
            }),

            new StringFilterBuilder({
                name: $t(`%c5`),
                key: 'postalCode',
            }),

            new StringFilterBuilder({
                name: $t('%7C'),
                key: 'uri',
            }),

            new GroupUIFilterBuilder({
                name: $t(`%1EH`),
                description: $t('%7f'),
                builders: getOrganizationMemberUIFilterBuilders(),
                wrapper: {
                    members: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`%1H0`),
                options: [
                    new MultipleChoiceUIFilterOption($t(`%1H0`), 1),
                    new MultipleChoiceUIFilterOption($t(`%7G`), 0),
                ],
                wrapper: {
                    active: {
                        $in: FilterWrapperMarker,
                    },
                },
            }),

            new MultipleChoiceFilterBuilder({
                name: $t(`%c6`),
                multipleChoiceConfiguration: {
                    isSubjectPlural: true,
                    mode: MultipleChoiceUIFilterMode.And,
                    showOptionSelectAll: true,
                },
                options: Object.entries(setupStepFilterNameMap).map(
                    ([k, v]) =>
                        new MultipleChoiceUIFilterOption(
                            v,
                            k as SetupStepType,
                        ),
                ),
                wrapFilter: (f: StamhoofdFilter) => {
                    const choices = Array.isArray(f) ? f : [f];

                    return {
                        setupSteps: {
                            $elemMatch: {
                                periodId: {
                                    $eq: platform.value.period.id,
                                },
                                ...Object.fromEntries(
                                    Object.values(SetupStepType)
                                        .filter(
                                            x => choices.includes(x),
                                        )
                                        .map((setupStep) => {
                                            return [
                                                setupStep,
                                                {
                                                    reviewedAt: {
                                                        $neq: null,
                                                    },
                                                    complete: true,
                                                },
                                            ];
                                        }),
                                ),
                            },
                        },
                    };
                },
                unwrapFilter: (f: StamhoofdFilter): StamhoofdFilter | null => {
                    if (typeof f !== 'object') return null;

                    const elemMatch = (f as any).setupSteps?.$elemMatch;
                    if (!elemMatch) return null;

                    const periodId = elemMatch.periodId?.$eq;

                    if (periodId !== platform.value.period.id) return null;

                    const enumValues = Object.values(SetupStepType);
                    const stringifiedValueToMatch = JSON.stringify({
                        reviewedAt: { $neq: null },
                        complete: true,
                    });

                    const results: SetupStepType[] = [];

                    for (const [key, value] of Object.entries(elemMatch as object)) {
                        if (enumValues.includes(key as SetupStepType)) {
                            if (JSON.stringify(value) === stringifiedValueToMatch) {
                                results.push(key as SetupStepType);
                            }
                            else {
                                return null;
                            }
                        }
                        else if (key !== 'periodId') {
                            return null;
                        }
                    }

                    if (results.length) {
                        return results;
                    }

                    return null;
                },
            }),
            new GroupUIFilterBuilder({
                name: $t(`%1Ke`),
                description: $t('%1CI'),
                builders: getOrganizationCompanyFilterBuilders(),
                wrapper: {
                    companies: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
        ];

        if (user?.permissions?.platform !== null) {
            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('%3G'),
                    multipleChoiceConfiguration: {
                        isSubjectPlural: true,
                    },
                    options: platform.value.config.tags.map((tag) => {
                        return new MultipleChoiceUIFilterOption(tag.name, tag.id);
                    }),
                    wrapper: {
                        tags: {
                            $in: FilterWrapperMarker,
                        },
                    },
                }),
            );
        }

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };

    return { getOrganizationUIFilterBuilders };
}
