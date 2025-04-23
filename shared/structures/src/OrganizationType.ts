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
    Nature = 'Nature',
    Music = 'Music',
    Professional = 'Professional',
    Art = 'Art',
    Culture = 'Culture',
    LGBTQ = 'LGBTQ',
    Politics = 'Politics',
    Union = 'Union',
    Other = 'Other',
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
                name: $t(`Jeugdbeweging`),
            },
            {
                value: OrganizationType.Football,
                name: $t(`Voetbal`),
            },
            {
                value: OrganizationType.Tennis,
                name: $t(`Tennis`),
            },
            {
                value: OrganizationType.Golf,
                name: $t(`Golf`),
            },
            {
                value: OrganizationType.Athletics,
                name: $t(`Atletiek`),
            },
            {
                value: OrganizationType.Badminton,
                name: $t(`Badminton`),
            },
            {
                value: OrganizationType.Hockey,
                name: $t(`Hockey`),
            },
            {
                value: OrganizationType.Cycling,
                name: $t(`Wielrennen`),
            },
            {
                value: OrganizationType.Swimming,
                name: $t(`Zwemmen`),
            },
            {
                value: OrganizationType.Dance,
                name: $t(`Dans`),
            },
            {
                value: OrganizationType.Volleyball,
                name: $t(`Volleybal`),
            },
            {
                value: OrganizationType.Basketball,
                name: $t(`Basketbal`),
            },
            {
                value: OrganizationType.Judo,
                name: $t(`Vechtkunst`),
            },
            {
                value: OrganizationType.Sport,
                name: $t(`Andere sport`),
            },
            {
                value: OrganizationType.Student,
                name: $t(`Studentenvereniging`),
            },
            {
                value: OrganizationType.HorseRiding,
                name: $t(`Paardensport`),
            },
            {
                value: OrganizationType.Neighborhood,
                name: $t(`Buurtvereniging`),
            },
            {
                value: OrganizationType.Nature,
                name: $t(`Natuurvereniging`),
            },
            {
                value: OrganizationType.Music,
                name: $t(`Muziekvereniging`),
            },
            {
                value: OrganizationType.Professional,
                name: $t(`Beroepsvereniging`),
            },
            {
                value: OrganizationType.Art,
                name: $t(`Kunstvereniging`),
            },
            {
                value: OrganizationType.Culture,
                name: $t(`Cultuur`),
            },
            {
                value: OrganizationType.LGBTQ,
                name: $t(`LGBTQ+`),
            },
            {
                value: OrganizationType.Politics,
                name: $t(`Politiek`),
            },
            {
                value: OrganizationType.Union,
                name: $t(`Vakbond`),
            },
            {
                value: OrganizationType.School,
                name: $t(`School`),
            },
            {
                value: OrganizationType.Other,
                name: $t(`Andere`),
            },
        ];
    }

    static getCategory(type: OrganizationType): string {
        switch (type) {
            case OrganizationType.Youth:
            case OrganizationType.Student:
                return $t(`Jeugd`);

            case OrganizationType.Sport:
            case OrganizationType.Football:
            case OrganizationType.Tennis:
            case OrganizationType.Golf:
            case OrganizationType.Athletics:
            case OrganizationType.Badminton:
            case OrganizationType.Hockey:
            case OrganizationType.Cycling:
            case OrganizationType.Swimming:
            case OrganizationType.Dance:
            case OrganizationType.Volleyball:
            case OrganizationType.Basketball:
            case OrganizationType.Judo:
            case OrganizationType.HorseRiding:
                return $t(`Sport`);

            case OrganizationType.Culture:
            case OrganizationType.Art:
            case OrganizationType.Music:
                return $t(`Cultuur`);

            case OrganizationType.Other:
            case OrganizationType.LGBTQ:
            case OrganizationType.Politics:
            case OrganizationType.Union:
            case OrganizationType.Nature:
            case OrganizationType.Professional:
            case OrganizationType.Neighborhood:
            case OrganizationType.School:
                return $t(`Overige`);
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
                            name: $t(`Takken`),
                            maximumRegistrations: 1,
                        }),
                    }),
                ];
            }

            if (umbrella === UmbrellaOrganization.ChiroNationaal) {
                return [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`Afdelingen`),
                            maximumRegistrations: 1,
                        }),
                    }),
                ];
            }

            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`Leeftijdsgroepen`),
                        maximumRegistrations: 1,
                    }),
                }),
            ];
        }

        if (type === OrganizationType.Dance) {
            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`Danslessen`),
                        maximumRegistrations: 1,
                    }),
                }),
            ];
        }

        if (this.getCategory(type) == 'Sport') {
            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`Leeftijdsgroepen`),
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
                    name: $t(`Leeftijdsgroepen`),
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
                            name: $t(`Weekends`),
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`Kampen`),
                        }),
                    }),
                ];

                return [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`Takken`),
                            maximumRegistrations: 1,
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`Activiteiten`),
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
                            name: $t(`Weekends`),
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`Kampen`),
                        }),
                    }),
                ];

                return [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`Afdelingen`),
                            maximumRegistrations: 1,
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`Activiteiten`),
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
                        name: $t(`Weekends`),
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`Kampen`),
                    }),
                }),
            ];

            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`Leeftijdsgroepen`),
                        maximumRegistrations: 1,
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`Activiteiten`),
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
                        name: $t(`Danslessen`),
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`Activiteiten`),
                    }),
                }),
            ];
        }

        if (this.getCategory(type) == 'Sport') {
            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`Leeftijdsgroepen`),
                        maximumRegistrations: 1,
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`Activiteiten`),
                    }),
                }),
            ];
        }

        // Feel free to add more customizations here
        return [];
    }
}
