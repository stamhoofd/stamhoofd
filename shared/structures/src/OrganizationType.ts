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
                name: $t(`65fb042a-156c-477a-8ae1-c08f83825572`),
            },
            {
                value: OrganizationType.Football,
                name: $t(`718a5780-39cb-4e3a-86cf-36b01deff5a4`),
            },
            {
                value: OrganizationType.Tennis,
                name: $t(`a6621627-ce47-41df-a715-1adda44fa4df`),
            },
            {
                value: OrganizationType.Golf,
                name: $t(`cc287710-eb24-4b30-827c-20ecccdcb04f`),
            },
            {
                value: OrganizationType.Athletics,
                name: $t(`4b46d657-a991-45bf-b176-6787d37b94d9`),
            },
            {
                value: OrganizationType.Badminton,
                name: $t(`73da6e39-663b-42f3-b2b5-5c87abe1975b`),
            },
            {
                value: OrganizationType.Hockey,
                name: $t(`b6ca6bd6-3ba1-445c-aefa-396efead493b`),
            },
            {
                value: OrganizationType.Cycling,
                name: $t(`1a6e956a-aa3c-4e04-8ac4-46d45180d6c9`),
            },
            {
                value: OrganizationType.Swimming,
                name: $t(`4f421dd6-86cb-4bd7-9227-f392b853150b`),
            },
            {
                value: OrganizationType.Dance,
                name: $t(`57d61e17-e863-4c23-979e-27193c7c3c4c`),
            },
            {
                value: OrganizationType.Volleyball,
                name: $t(`77e44404-8b56-4771-8c70-51efd8311a68`),
            },
            {
                value: OrganizationType.Basketball,
                name: $t(`f129e12b-9079-4a88-b94c-d6abace21e80`),
            },
            {
                value: OrganizationType.Judo,
                name: $t(`54d76e05-9a64-498b-9a2c-28d0eaf0a47b`),
            },
            {
                value: OrganizationType.Sport,
                name: $t(`1d961b51-bd9a-453d-8835-a0ab3c1f5bf3`),
            },
            {
                value: OrganizationType.Student,
                name: $t(`6ad28fe1-da51-4538-90a3-eb42553b7057`),
            },
            {
                value: OrganizationType.HorseRiding,
                name: $t(`45487ecf-8418-421b-9592-d5cb994b7776`),
            },
            {
                value: OrganizationType.Neighborhood,
                name: $t(`6a63ceb0-5926-42db-bb56-4d3a6bd81f7a`),
            },
            {
                value: OrganizationType.Nature,
                name: $t(`5aca8049-d981-4cc5-a86c-0c194047743d`),
            },
            {
                value: OrganizationType.Music,
                name: $t(`a40877f1-4d7b-469f-bd5f-574de9f443be`),
            },
            {
                value: OrganizationType.Professional,
                name: $t(`b1491db8-95be-4d67-ad4a-5edb124b23a5`),
            },
            {
                value: OrganizationType.Art,
                name: $t(`9086aa79-923c-4b8a-8926-45aeee3a8676`),
            },
            {
                value: OrganizationType.Culture,
                name: $t(`4097461e-1c92-471f-a537-ae3c6e22d365`),
            },
            {
                value: OrganizationType.LGBTQ,
                name: $t(`43f4f751-2752-4ecc-9d78-136853852b43`),
            },
            {
                value: OrganizationType.Politics,
                name: $t(`fc00d7a3-4ff4-4355-aef0-c73af12218f1`),
            },
            {
                value: OrganizationType.Union,
                name: $t(`bb555c1a-828f-49e2-b051-71fca51bee38`),
            },
            {
                value: OrganizationType.School,
                name: $t(`3ef919e4-b9a3-4b58-a316-83c9340c9830`),
            },
            {
                value: OrganizationType.Other,
                name: $t(`8f7475aa-c110-49b2-8017-1a6dd0fe72f9`),
            },
        ];
    }

    static getCategory(type: OrganizationType): string {
        switch (type) {
            case OrganizationType.Youth:
            case OrganizationType.Student:
                return $t(`f768ec1f-c743-474a-b6c1-e05271c58a3c`);

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
                return $t(`77a5d5d5-a1c6-476b-8fbf-354a40ca5fcb`);

            case OrganizationType.Culture:
            case OrganizationType.Art:
            case OrganizationType.Music:
                return $t(`4097461e-1c92-471f-a537-ae3c6e22d365`);

            case OrganizationType.Other:
            case OrganizationType.LGBTQ:
            case OrganizationType.Politics:
            case OrganizationType.Union:
            case OrganizationType.Nature:
            case OrganizationType.Professional:
            case OrganizationType.Neighborhood:
            case OrganizationType.School:
                return $t(`735e5a5b-5858-40d7-b195-9113ca6bf98c`);
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
                            name: $t(`a3dda733-9414-421b-8094-940cc7645f19`),
                            maximumRegistrations: 1,
                        }),
                    }),
                ];
            }

            if (umbrella === UmbrellaOrganization.ChiroNationaal) {
                return [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`be51c431-f45c-48a5-bca8-14cfd9616027`),
                            maximumRegistrations: 1,
                        }),
                    }),
                ];
            }

            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`5271f407-ec58-4802-ac69-7f357bc3cfc7`),
                        maximumRegistrations: 1,
                    }),
                }),
            ];
        }

        if (type === OrganizationType.Dance) {
            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`e34a3ade-b58d-4957-8e49-af0a76c6a0f5`),
                        maximumRegistrations: 1,
                    }),
                }),
            ];
        }

        if (this.getCategory(type) == 'Sport') {
            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`5271f407-ec58-4802-ac69-7f357bc3cfc7`),
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
                    name: $t(`5271f407-ec58-4802-ac69-7f357bc3cfc7`),
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
                            name: $t(`a248259d-cf0d-4942-a1b4-ec7e2b85246b`),
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`b3d7072c-9265-4c1f-a283-42ed2baca093`),
                        }),
                    }),
                ];

                return [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`a3dda733-9414-421b-8094-940cc7645f19`),
                            maximumRegistrations: 1,
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`d9b4472a-a395-4877-82fd-da6cb0140594`),
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
                            name: $t(`a248259d-cf0d-4942-a1b4-ec7e2b85246b`),
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`b3d7072c-9265-4c1f-a283-42ed2baca093`),
                        }),
                    }),
                ];

                return [
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`be51c431-f45c-48a5-bca8-14cfd9616027`),
                            maximumRegistrations: 1,
                        }),
                    }),
                    GroupCategory.create({
                        settings: GroupCategorySettings.create({
                            name: $t(`d9b4472a-a395-4877-82fd-da6cb0140594`),
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
                        name: $t(`a248259d-cf0d-4942-a1b4-ec7e2b85246b`),
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`b3d7072c-9265-4c1f-a283-42ed2baca093`),
                    }),
                }),
            ];

            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`5271f407-ec58-4802-ac69-7f357bc3cfc7`),
                        maximumRegistrations: 1,
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`d9b4472a-a395-4877-82fd-da6cb0140594`),
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
                        name: $t(`e34a3ade-b58d-4957-8e49-af0a76c6a0f5`),
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`d9b4472a-a395-4877-82fd-da6cb0140594`),
                    }),
                }),
            ];
        }

        if (this.getCategory(type) == 'Sport') {
            return [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`5271f407-ec58-4802-ac69-7f357bc3cfc7`),
                        maximumRegistrations: 1,
                    }),
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`d9b4472a-a395-4877-82fd-da6cb0140594`),
                    }),
                }),
            ];
        }

        // Feel free to add more customizations here
        return [];
    }
}
