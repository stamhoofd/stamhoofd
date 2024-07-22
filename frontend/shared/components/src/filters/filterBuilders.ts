import { Platform, StamhoofdFilter, User } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Gender } from "../../../../../shared/structures/esm/dist/src/members/Gender";
import { GroupUIFilterBuilder } from "./GroupUIFilter";
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from "./MultipleChoiceUIFilter";
import { NumberFilterBuilder } from "./NumberUIFilter";
import { StringFilterBuilder } from "./StringUIFilter";
import { UIFilterBuilders } from "./UIFilter";

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
            new MultipleChoiceUIFilterOption('Andere', Gender.Other)
        ],
        buildFilter: (choices) => {
            return {
                gender: {
                    $in: choices.map(c => c)
                }
            }
        }
    })
];

// Recursive: self referencing groups
memberWithRegistrationsBlobUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: memberWithRegistrationsBlobUIFilterBuilders
    })
)

export function getAdvancedMemberWithRegistrationsBlobUIFilterBuilders(platform: Platform, options: {user?: User|null} = {}) {
    const all = [
        ...memberWithRegistrationsBlobUIFilterBuilders.slice(1),
    ]

    if (options.user?.permissions?.platform !== null) {
        all.push(
            new MultipleChoiceFilterBuilder({
                name: 'Standaard leeftijdsgroep',
                options: platform.config.defaultAgeGroups.map(group => {
                    return new MultipleChoiceUIFilterOption(group.name, group.id);
                }),
                buildFilter: (choices) => {
                    return {
                        registrations: {
                            $elemMatch: {
                                group: {
                                    defaultAgeGroupId: {
                                        $in: choices.map(c => c)
                                    }
                                },
                                periodId: platform.period.id
                            }
                        }
                    }
                }
            })
        )

        all.push(
            new MultipleChoiceFilterBuilder({
                name: 'Functies',
                options: platform.config.responsibilities.map(responsibility => {
                    return new MultipleChoiceUIFilterOption(responsibility.name, responsibility.id);
                }),
                buildFilter: (choices) => {
                    return {
                        responsibilities: {
                            $elemMatch: {
                                responsibilityId: {
                                    $in: choices.map(c => c)
                                },
                                endDate: null
                            }
                        }
                    }
                }
            })
        )
    }

    all.push(
        new MultipleChoiceFilterBuilder({
            name: 'Aansluitingstatus',
            options: [
                new MultipleChoiceUIFilterOption('Actief', 'Active'),
                new MultipleChoiceUIFilterOption('Verlopen', 'Expiring'),
                new MultipleChoiceUIFilterOption('Inactief', 'Inactive'),
            ],
            buildFilter: (choices) => {
                const d = new Date()
                d.setHours(12);
                d.setMinutes(0);
                d.setSeconds(0);
                d.setMilliseconds(0);

                const filters: StamhoofdFilter[] = []
                const invertedFilters: StamhoofdFilter[] = []

                if (choices.includes('Active') && choices.includes('Expiring')) {
                    filters.push(...[
                        {
                            endDate: {
                                $gt: Formatter.dateIso(d)
                            },
                        }
                    ])
                }

                if (choices.includes('Active') && !choices.includes('Expiring')) {
                    filters.push(...[
                        {
                            expireDate: null,
                            endDate: {
                                $gt: Formatter.dateIso(d)
                            },
                        },
                        {
                            expireDate: {
                                $gt: Formatter.dateIso(d)
                            },
                        }
                    ])
                }

                if (!choices.includes('Active') && choices.includes('Expiring')) {
                    filters.push(...[
                        {
                            expireDate: {
                                $lt: Formatter.dateIso(d)
                            },
                            endDate: {
                                $gt: Formatter.dateIso(d)
                            },
                        }
                    ])
                }

                if (choices.includes('Inactive')) {
                    invertedFilters.push(...[
                        {
                            endDate: {
                                $gt: Formatter.dateIso(d)
                            },
                        }
                    ])
                }

                const filter: StamhoofdFilter = []

                if (filters.length > 0) {
                    filter.push({
                        platformMemberships: {
                            $elemMatch: {
                                $or: filters
                            }
                        }
                    })
                }

                if (invertedFilters.length > 0) {
                    filter.push({
                        $not: {
                            platformMemberships: {
                                $elemMatch: {
                                    $or: invertedFilters
                                }
                            }
                        }
                    })
                }

                if (filter.length == 1) {
                    return filter[0]
                }

                if (filter.length === 0) {
                    return []
                }

                return {
                    $or: filter
                }
            }
        })
    )

    all.push(
        new MultipleChoiceFilterBuilder({
            name: 'Actieve aansluiting',
            options: platform.config.membershipTypes.map(type => {
                return new MultipleChoiceUIFilterOption(type.name, type.id);
            }),
            buildFilter: (choices) => {
                const d = new Date()
                d.setHours(12);
                d.setMinutes(0);
                d.setSeconds(0);
                d.setMilliseconds(0);

                const filters: StamhoofdFilter = [
                    {
                        membershipTypeId: {
                            $in: choices as string[]
                        },
                        expireDate: null,
                        endDate: {
                            $gt: Formatter.dateIso(d)
                        },
                    },
                    {
                        membershipTypeId: {
                            $in: choices as string[]
                        },
                        expireDate: {
                            $gt: Formatter.dateIso(d)
                        },
                    }
                ]

                return {
                    platformMemberships: {
                        $elemMatch: {
                            $or: filters
                        }
                    }
                }
            }
        })
    )

    all.unshift(
        new GroupUIFilterBuilder({
            builders: all
        })
    )

    return all
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
        builders: checkoutUIFilterBuilders
    })
)

//
// ORGANIZATIONS
// 

const organizationMemberUIFilterBuilders: UIFilterBuilders = [
    new StringFilterBuilder({
        name: 'Naam',
        key: 'name'
    }),
    new StringFilterBuilder({
        name: 'Voornaam',
        key: 'firstName'
    }),
    new StringFilterBuilder({
        name: 'Achternaam',
        key: 'lastName'
    }),
    new StringFilterBuilder({
        name: 'E-mailadres',
        key: 'email'
    }),
]

export const organizationsUIFilterBuilders: UIFilterBuilders = [
    new StringFilterBuilder({
        name: 'Naam',
        key: 'name'
    }),
    new GroupUIFilterBuilder({
        name: 'Leden',
        builders: organizationMemberUIFilterBuilders,
        wrapFilter: (f) => {
            return {
                members: {
                    $elemMatch: f
                }
            }
        },
    }),
    new MultipleChoiceFilterBuilder({
        name: 'Actief',
        options: [
            new MultipleChoiceUIFilterOption('Actief', 1),
            new MultipleChoiceUIFilterOption('Inactief', 0)
        ],
        buildFilter: (choices) => {
            return {
                active: {
                    $in: choices.map(c => c)
                }
            }
        }
    })
];

// Recursive: self referencing groups
organizationsUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: organizationsUIFilterBuilders
    })
)

export const invoicesUIFilterBuilders: UIFilterBuilders = [
    new NumberFilterBuilder({
        name: 'Nummer',
        key: 'number'
    }),
];

// Recursive: self referencing groups
invoicesUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: invoicesUIFilterBuilders
    })
)
