import { GroupCategory, GroupCategorySettings } from './GroupCategory.js';
import { UmbrellaOrganization } from './UmbrellaOrganization.js';

export enum OrganizationType {
    Youth = 'Youth',
    Football = 'Football',
    Tennis = 'Tennis',
    Golf = 'Golf',
    Athletics = 'Athletics',
    Badminton = 'Badminton',
    Hockey = 'Hockey',
    Cycling = 'Cycling',
    Swimming = 'Swimming',
    Dance = 'Dance',
    Volleyball = 'Volleyball',
    Basketball = 'Basketball',
    Judo = 'Judo',
    Sport = 'Sport',
    School = 'School',
    Student = 'Student',
    HorseRiding = 'HorseRiding',
    Neighborhood = 'Neighborhood',
    Gymnastics = 'Gymnastics',
    Nature = 'Nature',
    Music = 'Music',
    Professional = 'Professional',
    Art = 'Art',
    Culture = 'Culture',
    LGBTQ = 'LGBTQ',
    Politics = 'Politics',
    Union = 'Union',
    ParentsCommittee = 'ParentsCommittee',
    GoodCause = 'GoodCause',
    Kids = 'Kids',
    Other = 'Other',
    City = 'City',
    Events = 'Events',
    Business = 'Business',
    Stage = 'Stage',
}

export class OrganizationTypeHelper {
    static getName(type: OrganizationType) {
        const l = this.getList();
        return l.find(v => v.value === type)?.name ?? type.toString();
    }

    static getList() {
        return [
            {
                value: OrganizationType.Youth,
                name: $t(`%mA`),
            },
            {
                value: OrganizationType.Football,
                name: $t(`%mB`),
            },
            {
                value: OrganizationType.Tennis,
                name: $t(`%1l`),
            },
            {
                value: OrganizationType.Golf,
                name: $t(`%27`),
            },
            {
                value: OrganizationType.Gymnastics,
                name: $t('Turnen'),
            },
            {
                value: OrganizationType.Athletics,
                name: $t(`%mC`),
            },
            {
                value: OrganizationType.Badminton,
                name: $t(`%1H`),
            },
            {
                value: OrganizationType.Hockey,
                name: $t(`%1w`),
            },
            {
                value: OrganizationType.Cycling,
                name: $t(`%mD`),
            },
            {
                value: OrganizationType.Swimming,
                name: $t(`%mE`),
            },
            {
                value: OrganizationType.Dance,
                name: $t(`%mF`),
            },
            {
                value: OrganizationType.Volleyball,
                name: $t(`%mG`),
            },
            {
                value: OrganizationType.Basketball,
                name: $t(`%mH`),
            },
            {
                value: OrganizationType.Judo,
                name: $t(`%mI`),
            },
            {
                value: OrganizationType.Sport,
                name: $t(`%mJ`),
            },
            {
                value: OrganizationType.Student,
                name: $t(`%mK`),
            },
            {
                value: OrganizationType.HorseRiding,
                name: $t(`%mL`),
            },
            {
                value: OrganizationType.Neighborhood,
                name: $t(`%mM`),
            },
            {
                value: OrganizationType.Nature,
                name: $t(`%mN`),
            },
            {
                value: OrganizationType.Music,
                name: $t(`%mO`),
            },
            {
                value: OrganizationType.Events,
                name: $t('Evenementen'),
            },
            {
                value: OrganizationType.Professional,
                name: $t(`%mP`),
            },
            {
                value: OrganizationType.Art,
                name: $t(`%mQ`),
            },
            {
                value: OrganizationType.Stage,
                name: $t('Theater (toneel, musical, ...)'),
            },
            {
                value: OrganizationType.Culture,
                name: $t(`%mR`),
            },
            // {
            //     value: OrganizationType.LGBTQ,
            //     name: $t(`%t`),
            // },
            {
                value: OrganizationType.Politics,
                name: $t(`%mS`),
            },
            // {
            //     value: OrganizationType.Union,
            //     name: $t(`%mT`),
            // },
            {
                value: OrganizationType.School,
                name: $t(`%p`),
            },
            {
                value: OrganizationType.Kids,
                name: $t('Kinderen (kampen, speelpleinwerking, ...)'),
            },
            {
                value: OrganizationType.ParentsCommittee,
                name: $t('Oudercomité'),
            },
            {
                value: OrganizationType.GoodCause,
                name: $t('Goed doel'),
            },
            {
                value: OrganizationType.City,
                name: $t('Gemeente of stad'),
            },
            {
                value: OrganizationType.Business,
                name: $t('Bedrijf'),
            },
            {
                value: OrganizationType.Other,
                name: $t(`%1JG`),
            },
        ];
    }

    static getCategory(type: OrganizationType): string {
        switch (type) {
            case OrganizationType.Youth:
            case OrganizationType.Student:
            case OrganizationType.Kids:
                return $t(`%mU`);

            case OrganizationType.Sport:
            case OrganizationType.Football:
            case OrganizationType.Tennis:
            case OrganizationType.Golf:
            case OrganizationType.Athletics:
            case OrganizationType.Badminton:
            case OrganizationType.Hockey:
            case OrganizationType.Cycling:
            case OrganizationType.Swimming:
            case OrganizationType.Volleyball:
            case OrganizationType.Basketball:
            case OrganizationType.Judo:
            case OrganizationType.HorseRiding:
            case OrganizationType.Gymnastics:
                return $t(`%1I`);

            case OrganizationType.Culture:
            case OrganizationType.Art:
            case OrganizationType.Music:
            case OrganizationType.Stage:
            case OrganizationType.Events:
            case OrganizationType.Dance:
                return $t(`%mR`);

            case OrganizationType.School:
                return $t('Onderwijs');

            case OrganizationType.Other:
            case OrganizationType.ParentsCommittee:
            case OrganizationType.LGBTQ:
            case OrganizationType.Politics:
            case OrganizationType.Union:
            case OrganizationType.Nature:
            case OrganizationType.Professional:
            case OrganizationType.Neighborhood:
            case OrganizationType.GoodCause:
            case OrganizationType.City:
            case OrganizationType.Business:
                return $t(`%mV`);
        }
    }

    /**
     * Return default group categories BEFORE the update with activities!
     * @param type
     * @param umbrella
     */
    static getDefaultGroupCategoriesWithoutActivities(type: OrganizationType, umbrella?: UmbrellaOrganization): GroupCategory[] {
        if (type === OrganizationType.Youth) {
            if (umbrella === UmbrellaOrganization.ScoutsEnGidsenVlaanderen) {
                return [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`%mW`),
                            maximumRegistrations: 1,
                        }),
                    }),
                ];
            }

            if (umbrella === UmbrellaOrganization.ChiroNationaal) {
                return [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`%mX`),
                            maximumRegistrations: 1,
                        }),
                    }),
                ];
            }

            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`%P4`),
                        maximumRegistrations: 1,
                    }),
                }),
            ];
        }

        if (type === OrganizationType.Dance) {
            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`%mY`),
                        maximumRegistrations: 1,
                    }),
                }),
            ];
        }

        if (this.getCategory(type) == 'Sport') {
            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`%P4`),
                        maximumRegistrations: 1,
                    }),
                }),
            ];
        }

        // Feel free to add more customizations here
        return [
            // Always need one minimum
            GroupCategory.create({
                settings: GroupCategorySettings.create({
                    name: $t(`%P4`),
                    maximumRegistrations: 1,
                }),
            }),
        ];
    }

    /**
     * Return default group categories for a given type and umbrella (optional), without the root category
     * @param type
     * @param umbrella
     */
    static getDefaultGroupCategories(type: OrganizationType, umbrella?: UmbrellaOrganization): GroupCategory[] {
        if (type === OrganizationType.Youth) {
            if (umbrella === UmbrellaOrganization.ScoutsEnGidsenVlaanderen) {
                const activities = [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`%1g`),
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`%mZ`),
                        }),
                    }),
                ];

                return [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`%mW`),
                            maximumRegistrations: 1,
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`%uB`),
                        }),
                        categoryIds: activities.map(c => c.id),
                    }),
                    ...activities,
                ];
            }

            if (umbrella === UmbrellaOrganization.ChiroNationaal) {
                const activities = [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`%1g`),
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`%mZ`),
                        }),
                    }),
                ];

                return [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`%mX`),
                            maximumRegistrations: 1,
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`%uB`),
                        }),
                        categoryIds: activities.map(c => c.id),
                    }),
                    ...activities,
                ];
            }

            // Feel free to add more customizations here
            const activities = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`%1g`),
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`%mZ`),
                    }),
                }),
            ];

            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`%P4`),
                        maximumRegistrations: 1,
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`%uB`),
                    }),
                    categoryIds: activities.map(c => c.id),
                }),
                ...activities,
            ];
        }

        if (type === OrganizationType.Dance) {
            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`%mY`),
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`%uB`),
                    }),
                }),
            ];
        }

        if (this.getCategory(type) == 'Sport') {
            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`%P4`),
                        maximumRegistrations: 1,
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`%uB`),
                    }),
                }),
            ];
        }

        // Feel free to add more customizations here
        return [];
    }
}
