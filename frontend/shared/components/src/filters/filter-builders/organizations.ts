import type { StamhoofdFilter } from '@stamhoofd/structures';
import { CountryHelper, FilterWrapperMarker, OrganizationType, OrganizationTypeHelper, SetupStepType, STPackageType, STPackageTypeHelper, UmbrellaOrganization, UmbrellaOrganizationHelper } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useUser } from '#hooks/useUser.ts';
import { getOrganizationCompanyFilterBuilders } from '../filterBuilders';
import { useDocumentTemplateUIFilterBuilders } from './document-templates';
import { DateFilterBuilder } from '../DateUIFilter';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterMode, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilterBuilder, UIFilterBuilders } from '../UIFilter';

const getOrganizationMemberUIFilterBuilders: () => UIFilterBuilders = () => {
    const builders: UIFilterBuilders = [
        new StringFilterBuilder({
            name: $t(`%1Os`),
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

const getOrganizationAdminUIFilterBuilders: () => UIFilterBuilders = () => {
    const builders: UIFilterBuilders = [
        new StringFilterBuilder({
            name: $t(`%1Os`),
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

export function useGetOrganizationUIFilterBuilders(options: { onlyBaseFilters?: boolean } = { onlyBaseFilters: false }) {
    const platform = usePlatform();
    const _user = useUser();
    const documentTemplateFilterBuilders = useDocumentTemplateUIFilterBuilders();

    const setupStepFilterNameMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('%7D'),
        [SetupStepType.Companies]: $t('%6b'),
        [SetupStepType.Groups]: $t('%P4'),
        [SetupStepType.Premises]: $t('%6c'),
        [SetupStepType.Emails]: $t('%vG'),
        [SetupStepType.Payment]: $t('%O7'),
        [SetupStepType.Registrations]: $t('%1EI'),
    };

    function ifNotBase(filter: UIFilterBuilder | null) {
        if (options.onlyBaseFilters) {
            return null;
        }

        return filter;
    }

    function ifNotPlatform(filter: UIFilterBuilder | null) {
        if (STAMHOOFD.userMode === 'platform') {
            return null;
        }

        return filter;
    }

    function ifPlatform(filter: UIFilterBuilder | null) {
        if (STAMHOOFD.userMode === 'organization') {
            return null;
        }

        return filter;
    }

    const getOrganizationUIFilterBuilders = () => {
        const user = _user.value;
        const all = [
            new StringFilterBuilder({
                name: $t(`%1Os`),
                key: 'name',
            }),

            new StringFilterBuilder({
                name: $t(`%Co`),
                key: 'street',
            }),

            new StringFilterBuilder({
                name: $t(`%1PP`),
                key: 'city',
            }),

            new StringFilterBuilder({
                name: $t(`%c5`),
                key: 'postalCode',
            }),

            new MultipleChoiceFilterBuilder({
                name: $t(`%Cp`),
                multipleChoiceConfiguration: {
                    isSubjectPlural: true,
                },
                options: Object.values(Country).map(country => new MultipleChoiceUIFilterOption(CountryHelper.getName(country), country)),
                wrapper: {
                    country: {
                        $in: FilterWrapperMarker,
                    },
                },
            }),

            new StringFilterBuilder({
                name: $t('%1O1'),
                key: 'uri',
            }),

            new DateFilterBuilder({
                name: $t(`%1Jc`),
                key: 'createdAt',
            }),

            ifNotBase(new GroupUIFilterBuilder({
                name: $t(`%1EH`),
                description: $t('%7f'),
                builders: getOrganizationMemberUIFilterBuilders(),
                wrapper: {
                    members: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            })),
            ifNotPlatform(ifNotBase(new GroupUIFilterBuilder({
                name: $t(`%K5`),
                description: $t('%1dr'),
                builders: getOrganizationAdminUIFilterBuilders(),
                wrapper: {
                    admins: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }))),
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

            ifNotPlatform(new MultipleChoiceFilterBuilder({
                name: $t(`%1Qj`),
                multipleChoiceConfiguration: {
                    isSubjectPlural: true,
                },
                options: [
                    STPackageType.Members,
                    STPackageType.Webshops,
                    STPackageType.SingleWebshop,
                    STPackageType.TrialMembers,
                    STPackageType.TrialWebshops,
                    STPackageType.LegacyMembers,
                ].map(type => new MultipleChoiceUIFilterOption(STPackageTypeHelper.getName(type), type)),
                wrapper: {
                    packages: {
                        $elemMatch: {
                            type: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    },
                },
            })),

            ifNotPlatform(new MultipleChoiceFilterBuilder({
                name: $t(`%1LP`),
                multipleChoiceConfiguration: {
                    isSubjectPlural: true,
                },
                options: Object.values(OrganizationType).map(type => new MultipleChoiceUIFilterOption(OrganizationTypeHelper.getName(type), type)),
                wrapper: {
                    type: {
                        $in: FilterWrapperMarker,
                    },
                },
            })),

            ifNotPlatform(new MultipleChoiceFilterBuilder({
                name: $t(`%ZZd`),
                multipleChoiceConfiguration: {
                    isSubjectPlural: true,
                },
                options: Object.values(UmbrellaOrganization).map(umbrella => new MultipleChoiceUIFilterOption(UmbrellaOrganizationHelper.getName(umbrella), umbrella)),
                wrapper: {
                    umbrellaOrganization: {
                        $in: FilterWrapperMarker,
                    },
                },
            })),

            ifPlatform(ifNotBase(new MultipleChoiceFilterBuilder({
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
                            } else {
                                return null;
                            }
                        } else if (key !== 'periodId') {
                            return null;
                        }
                    }

                    if (results.length) {
                        return results;
                    }

                    return null;
                },
            }))),
            ifNotBase(new GroupUIFilterBuilder({
                name: $t(`%1Ke`),
                description: $t('%1CI'),
                builders: getOrganizationCompanyFilterBuilders(),
                wrapper: {
                    companies: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            })),

            ifNotBase(new StringFilterBuilder({
                name: $t('%ZbU'),
                key: 'recordCategoryName',
            })),

            ifNotBase(new StringFilterBuilder({
                name: $t('%Zbf'),
                key: 'recordChildCategoryName',
            })),

            ifNotBase(new StringFilterBuilder({
                name: $t('%Zbc'),
                key: 'recordName',
            })),

            ifNotBase(new GroupUIFilterBuilder({
                name: $t('%tw'),
                description: $t('%Zbm'),
                builders: documentTemplateFilterBuilders,
                wrapper: {
                    documentTemplates: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            })),
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

        const builders = all.filter(b => b !== null);

        // Recursive: self referencing groups
        builders.unshift(
            new GroupUIFilterBuilder({
                builders,
            }),
        );

        return builders;
    };

    return { getOrganizationUIFilterBuilders };
}
