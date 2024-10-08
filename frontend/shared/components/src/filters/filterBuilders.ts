import { useTranslate } from "@stamhoofd/frontend-i18n";
import { CachedOutstandingBalanceType, Organization, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, Platform, SetupStepType, StamhoofdCompareValue, StamhoofdFilter, User } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Gender } from "../../../../../shared/structures/esm/dist/src/members/Gender";
import { usePlatform } from "../hooks";
import { GroupUIFilterBuilder } from "./GroupUIFilter";
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterMode, MultipleChoiceUIFilterOption } from "./MultipleChoiceUIFilter";
import { NumberFilterBuilder } from "./NumberUIFilter";
import { StringFilterBuilder } from "./StringUIFilter";
import { UIFilter, UIFilterBuilder, UIFilterBuilders, UIFilterWrapperMarker, unwrapFilter } from "./UIFilter";

export const paymentsUIFilterBuilders: UIFilterBuilders = [
    new MultipleChoiceFilterBuilder({
        name: 'Betaalmethode',
        options: Object.values(PaymentMethod).map((method) => {
            return new MultipleChoiceUIFilterOption(PaymentMethodHelper.getNameCapitalized(method), method);
        }),
        wrapper: {
            method: {
                $in: UIFilterWrapperMarker,
            },
        },
    }),

    new MultipleChoiceFilterBuilder({
        name: 'Status',
        options: Object.values(PaymentStatus).map((method) => {
            return new MultipleChoiceUIFilterOption(PaymentStatusHelper.getNameCapitalized(method), method);
        }),
        wrapper: {
            status: {
                $in: UIFilterWrapperMarker,
            },
        },
    }),
];

// Recursive: self referencing groups
paymentsUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: paymentsUIFilterBuilders,
    }),
);

// This one should match memberWithRegistrationsBlobInMemoryFilterCompilers
export const memberWithRegistrationsBlobUIFilterBuilders: UIFilterBuilders = [
    new NumberFilterBuilder({
        name: 'Leeftijd',
        key: 'age',
    }),
    new MultipleChoiceFilterBuilder({
        name: 'Gender',
        options: [
            new MultipleChoiceUIFilterOption('Vrouw', Gender.Female),
            new MultipleChoiceUIFilterOption('Man', Gender.Male),
            new MultipleChoiceUIFilterOption('Andere', Gender.Other),
        ],
        wrapper: {
            gender: {
                $in: UIFilterWrapperMarker,
            },
        },
    }),
];

// Recursive: self referencing groups
memberWithRegistrationsBlobUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: memberWithRegistrationsBlobUIFilterBuilders,
    }),
);

// This one should match registrationInMemoryFilterCompilers
export const registrationUIFilterBuilders: UIFilterBuilders = [
    // tood
];

// Recursive: self referencing groups
registrationUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: registrationUIFilterBuilders,
    }),
);

export function getAdvancedMemberWithRegistrationsBlobUIFilterBuilders(platform: Platform, options: { user?: User | null } = {}) {
    const all = [
        ...memberWithRegistrationsBlobUIFilterBuilders.slice(1),
    ];

    if (options.user?.permissions?.platform !== null) {
        all.push(
            new StringFilterBuilder({
                name: 'Groepsnummer',
                key: 'uri',
                wrapper: {
                    registrations: {
                        $elemMatch: {
                            organization: UIFilterWrapperMarker,
                            periodId: platform.period.id,
                        },
                    },
                },
            }),
        );

        all.push(
            new MultipleChoiceFilterBuilder({
                name: 'Functies',
                multipleChoiceConfiguration: {
                    isSubjectPlural: true,
                },
                options: platform.config.responsibilities.map((responsibility) => {
                    return new MultipleChoiceUIFilterOption(responsibility.name, responsibility.id);
                }),
                wrapper: {
                    responsibilities: {
                        $elemMatch: {
                            responsibilityId: {
                                $in: UIFilterWrapperMarker,
                            },
                            endDate: null,
                        },
                    },
                },
            }),
        );

        all.push(
            new MultipleChoiceFilterBuilder({
                name: 'Tags',
                multipleChoiceConfiguration: {
                    isSubjectPlural: true,
                },
                options: platform.config.tags.map((tag) => {
                    return new MultipleChoiceUIFilterOption(tag.name, tag.id);
                }),
                wrapper: {
                    registrations: {
                        $elemMatch: {
                            organization: {
                                tags: {
                                    $in: UIFilterWrapperMarker,
                                },
                            },
                            periodId: platform.period.id,
                        },
                    },
                },
            }),
        );

        for (const responsibility of platform.config.responsibilities) {
            if (!responsibility.organizationBased || responsibility.defaultAgeGroupIds === null) {
                continue;
            }

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: responsibility.name,
                    options: platform.config.defaultAgeGroups.filter(group => responsibility.defaultAgeGroupIds?.includes(group.id)).map((group) => {
                        return new MultipleChoiceUIFilterOption(group.name, group.id);
                    }),
                    wrapper: {
                        responsibilities: {
                            $elemMatch: {
                                responsibilityId: responsibility.id,
                                endDate: null,
                                group: {
                                    defaultAgeGroupId: {
                                        $in: UIFilterWrapperMarker,
                                    },
                                },
                            },
                        },
                    },
                }),
            );
        }
    }

    all.push(
        new MultipleChoiceFilterBuilder({
            name: 'Standaard leeftijdsgroep',
            options: platform.config.defaultAgeGroups.map((group) => {
                return new MultipleChoiceUIFilterOption(group.name, group.id);
            }),
            wrapper: {
                registrations: {
                    $elemMatch: {
                        group: {
                            defaultAgeGroupId: {
                                $in: UIFilterWrapperMarker,
                            },
                        },
                        periodId: platform.period.id,
                    },
                },
            },
        }),
    );

    all.push(
        new MultipleChoiceFilterBuilder({
            name: 'Aansluitingstatus',
            options: [
                new MultipleChoiceUIFilterOption('Actief', 'Active'),
                new MultipleChoiceUIFilterOption('Verlopen', 'Expiring'),
                new MultipleChoiceUIFilterOption('Inactief', 'Inactive'),
            ],
            wrapFilter: (f: StamhoofdFilter) => {
                const choices = Array.isArray(f) ? f : [f];

                if(choices.length === 3) {
                    return null;
                }

                const activeOrExpiringFilter: StamhoofdFilter = {
                    platformMemberships: {
                        $elemMatch: {
                            startDate: {
                                $lte: {$: '$now'}
                            },
                            endDate: {
                                $gt: {$: '$now'}
                            }
                        }
                    }
                };

                if(choices.length === 2 && ['Active', 'Expiring'].every(x => choices.includes(x))) {
                    return activeOrExpiringFilter;
                }

                const getFilter = (choice: StamhoofdFilter<StamhoofdCompareValue>): StamhoofdFilter => {
                    switch(choice) {
                        case 'Active': {
                            return {
                                platformMemberships: {
                                    $elemMatch: {
                                        endDate: {
                                            $gt: {$: '$now'}
                                        },
                                        startDate: {
                                            $lte: {$: '$now'}
                                        },
                                        $or: [
                                            {
                                                expireDate: null
                                            },
                                            {
                                                expireDate: {
                                                    $gt: {$: '$now'}
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                        case 'Inactive': {
                            return {
                                $not: activeOrExpiringFilter
                            }
                        }
                        case 'Expiring': {
                            return {
                                $not: getFilter('Active'),
                                platformMemberships: {
                                    $elemMatch: {
                                        endDate: {
                                            $gte: {$: '$now'}
                                        },
                                        expireDate: {
                                            $lt: {$: '$now'}
                                        }
                                    }
                                }
                            }
                        }
                        default: {
                            return null;
                        }
                    }
                }

                const filters = choices.map(getFilter);

                if(filters.length === 1) {
                    return filters[0];
                }

                return {
                    $or: filters
                }
            },
            unwrapFilter: (f: StamhoofdFilter): StamhoofdFilter | null => {
                const activeAndExpiring = unwrapFilter(f, {
                    platformMemberships: {
                        $elemMatch: {
                            endDate: {
                                $gt: { $: '$now' },
                            },
                        },
                    },
                });

                if (activeAndExpiring.match) {
                    return ['Active', 'Expiring'];
                }

                return null;
            },
        }),
    );

    all.push(
        new MultipleChoiceFilterBuilder({
            name: 'Actieve aansluiting',
            options: platform.config.membershipTypes.map((type) => {
                return new MultipleChoiceUIFilterOption(type.name, type.id);
            }),
            wrapFilter: (f: StamhoofdFilter) => {
                const choices = Array.isArray(f) ? f : [f];
                const d = new Date();
                d.setHours(12);
                d.setMinutes(0);
                d.setSeconds(0);
                d.setMilliseconds(0);

                const filters: StamhoofdFilter = [
                    {
                        membershipTypeId: {
                            $in: choices as string[],
                        },
                        expireDate: null,
                        endDate: {
                            $gt: Formatter.dateIso(d),
                        },
                    },
                    {
                        membershipTypeId: {
                            $in: choices as string[],
                        },
                        expireDate: {
                            $gt: Formatter.dateIso(d),
                        },
                    },
                ];

                return {
                    platformMemberships: {
                        $elemMatch: {
                            $or: filters,
                        },
                    },
                };
            },
        }),
    );

    all.unshift(
        new GroupUIFilterBuilder({
            builders: all,
        }),
    );

    return all;
}

//
// CHECKOUT
//

// This one should match memberWithRegistrationsBlobInMemoryFilterCompilers
export const checkoutUIFilterBuilders: UIFilterBuilders = [
    // todo
];

// Recursive: self referencing groups
checkoutUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: checkoutUIFilterBuilders,
    }),
);

// Cached outstanding balances

export const cachedOutstandingBalanceUIFilterBuilders: UIFilterBuilders = [
    new MultipleChoiceFilterBuilder({
        name: 'Type',
        options: [
            new MultipleChoiceUIFilterOption('Verenigingen', CachedOutstandingBalanceType.organization),
            new MultipleChoiceUIFilterOption('Leden', CachedOutstandingBalanceType.member),
            new MultipleChoiceUIFilterOption('Accounts', CachedOutstandingBalanceType.user),
        ],
        wrapper: {
            objectType: {
                $in: UIFilterWrapperMarker,
            },
        },
    }),
];

cachedOutstandingBalanceUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: cachedOutstandingBalanceUIFilterBuilders,
    }),
);

//
// ORGANIZATIONS
//

const organizationMemberUIFilterBuilders: UIFilterBuilders = [
    new StringFilterBuilder({
        name: 'Naam',
        key: 'name',
    }),
    new StringFilterBuilder({
        name: 'Voornaam',
        key: 'firstName',
    }),
    new StringFilterBuilder({
        name: 'Achternaam',
        key: 'lastName',
    }),
    new StringFilterBuilder({
        name: 'E-mailadres',
        key: 'email',
    }),
];

export function useGetOrganizationUIFilterBuilders() {
    const $t = useTranslate();
    const platform = usePlatform();

    const setupStepFilterNameMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('be92d7b0-92ad-42d6-b9e2-b414671ac57d'),
        [SetupStepType.Companies]: $t('6313a021-6795-4b7e-842c-f4574e433324'),
        [SetupStepType.Groups]: $t('b6458e9c-2ddf-4cb0-8051-fb6a220c4127'),
        [SetupStepType.Premises]: $t('7f531562-9609-456e-a8c3-2b373cad3f29'),
        [SetupStepType.Emails]: $t('36a44efc-4cb0-4180-8678-938cc51d3ae8'),
        [SetupStepType.Payment]: $t('d951a3d6-58f6-4e56-a482-2b8652ddd3bf'),
        [SetupStepType.Registrations]: $t('98a4f650-2fc9-455f-8454-dfe7a8140faa'),
    };

    const getOrganizationUIFilterBuilders = (user: User | null) => {
        const all = [new StringFilterBuilder({
            name: 'Naam',
            key: 'name',
        }),
        new GroupUIFilterBuilder({
            name: 'Leden',
            builders: organizationMemberUIFilterBuilders,
            wrapper: {
                members: {
                    $elemMatch: UIFilterWrapperMarker,
                },
            },
        }),
        new MultipleChoiceFilterBuilder({
            name: 'Actief',
            options: [
                new MultipleChoiceUIFilterOption('Actief', 1),
                new MultipleChoiceUIFilterOption('Inactief', 0),
            ],
            wrapper: {
                active: {
                    $in: UIFilterWrapperMarker,
                },
            },
        })];

        if (user?.permissions?.platform !== null) {
            all.push(
                new MultipleChoiceFilterBuilder({
                    name: 'Voltooide vlagmomenten',
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

                        for (const [key, value] of Object.entries(elemMatch)) {
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
                },
                ),
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

// Events
export function getEventUIFilterBuilders(platform: Platform, organizations: Organization[]) {
    const all: UIFilterBuilder<UIFilter>[] = [];

    const groupFilter = new MultipleChoiceFilterBuilder({
        name: 'Lokale groep',
        options: [
            new MultipleChoiceUIFilterOption('Nationale activiteiten', null),
            ...organizations.map(org => new MultipleChoiceUIFilterOption(org.name, org.id)),
        ],
        wrapper: {
            organizationId: {
                $in: UIFilterWrapperMarker,
            },
        },
    });
    all.push(groupFilter);

    if (organizations.length !== 1) {
        const tagsFilter = new MultipleChoiceFilterBuilder({
            name: 'Tags',
            options: [
                new MultipleChoiceUIFilterOption('Alle tags', null),
                ...platform.config.tags.map(tag => new MultipleChoiceUIFilterOption(tag.name, tag.id)),
            ],
            wrapper: {
                organizationTagIds: {
                    $in: UIFilterWrapperMarker,
                },
            },
        });

        all.push(tagsFilter);

        const defaultAgeGroupFilter = new MultipleChoiceFilterBuilder({
            name: 'Standaard leeftijdsgroep',
            options: [
                new MultipleChoiceUIFilterOption('Iedereen', null),
                ...platform.config.defaultAgeGroups.map(g => new MultipleChoiceUIFilterOption(g.name, g.id)),
            ],
            wrapper: {
                defaultAgeGroupIds: {
                    $in: UIFilterWrapperMarker,
                },
            },
        });
        all.push(defaultAgeGroupFilter);
    }

    if (organizations.length > 0) {
        const groupFilter = new MultipleChoiceFilterBuilder({
            name: 'Inschrijvingsgroep',
            options: [
                new MultipleChoiceUIFilterOption('Iedereen', null),
                ...organizations
                    .flatMap(g => g.period.publicCategoryTree.getAllGroups().map((gg) => { return { organization: g, group: gg }; }))
                    .map(g => new MultipleChoiceUIFilterOption((organizations.length > 1 ? (g.organization.name + ' - ') : '') + g.group.settings.name, g.group.id)),
            ],
            wrapper: {
                groupIds: {
                    $in: UIFilterWrapperMarker,
                },
            },
        });
        all.push(groupFilter);
    }

    all.unshift(
        new GroupUIFilterBuilder({
            builders: all,
        }),
    );

    return all;
}
