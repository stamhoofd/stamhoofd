
import { GroupCategory, GroupCategorySettings, GroupGenderType, GroupSettings, OrganizationGenderType, OrganizationType, OrganizationTypeHelper, UmbrellaOrganization } from '@stamhoofd/structures'
import { Group as GroupStruct } from "@stamhoofd/structures";
import { Group } from '../models/Group';
import { Organization } from '../models/Organization';

export class GroupBuilder {
    organization: Organization

    constructor(organization: Organization) {
        this.organization = organization
    }

    async build() {
        const oldGroups = await Group.where({ organizationId: this.organization.id })

        if (oldGroups.length === 0) {
            // Setup default groups if possible
            if (this.organization.meta.type == OrganizationType.Youth && this.organization.meta.umbrellaOrganization == UmbrellaOrganization.ScoutsEnGidsenVlaanderen) {
                await this.createSGVGroups()
            } else if (this.organization.meta.type == OrganizationType.Youth && this.organization.meta.umbrellaOrganization == UmbrellaOrganization.ChiroNationaal) {
                await this.createChiroGroups()
            }
        }

        // Reload
        const groups = await Group.where({ organizationId: this.organization.id })
        
        // Setup default root groups
        if (this.organization.meta.categories.length <= 2) {
            const sortedGroupIds = groups.map(g => GroupStruct.create(Object.assign({}, g, { privateSettings: null }))).sort(GroupStruct.defaultSort).map(g => g.id)

            const defaults = this.organization.meta.packages.useActivities ? OrganizationTypeHelper.getDefaultGroupCategories(this.organization.meta.type, this.organization.meta.umbrellaOrganization ?? undefined) : OrganizationTypeHelper.getDefaultGroupCategoriesWithoutActivities(this.organization.meta.type, this.organization.meta.umbrellaOrganization ?? undefined)

            if (sortedGroupIds.length > 0 && defaults.length == 0) {
                defaults.push(GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: "Leeftijdsgroepen",
                        maximumRegistrations: 1
                    })
                }))
            }
            this.organization.meta.categories = [GroupCategory.create({ id: "root" }), ...defaults]
            this.organization.meta.rootCategoryId = "root"

             // Set category ID of the root category
            const filter = defaults.flatMap(d => d.categoryIds)
            this.organization.meta.rootCategory!.categoryIds = defaults.map(d => d.id).filter(id => !filter.includes(id))

            if (defaults.length > 0) {
                defaults[0].groupIds.push(...sortedGroupIds)
            }

            await this.organization.save()
        } else {
            const newGroups = groups.filter(g => !oldGroups.find(gg => gg.id === g.id))
            const sortedGroupIds = newGroups.map(g => GroupStruct.create(Object.assign({}, g, { privateSettings: null }))).sort(GroupStruct.defaultSort).map(g => g.id)
            let root = this.organization.meta.rootCategory!
            if (root.categoryIds.length > 0) {
                for (const id of root.categoryIds) {
                    const f = this.organization.meta.categories.find(c => c.id === id)
                    if (f) {
                        root = f
                        break
                    }
                }
            }

            if (newGroups.length > 0) {
                root.groupIds.push(...sortedGroupIds)
                await this.organization.save()
            }
        }
    }
    
    async createSGVGroups() {
        const createdGroups: Group[] = []
        const mixedType = this.organization.meta.genderType == OrganizationGenderType.OnlyMale ? 
        GroupGenderType.OnlyMale : 
            (this.organization.meta.genderType == OrganizationGenderType.OnlyFemale ? 
                GroupGenderType.OnlyFemale : 
                GroupGenderType.Mixed)

        const kapoenen = new Group()
        kapoenen.organizationId = this.organization.id
        kapoenen.settings = GroupSettings.create({
            name: "Kapoenen",
            genderType: mixedType,
            startDate: this.organization.meta.defaultStartDate,
            endDate: this.organization.meta.defaultEndDate,
            registrationStartDate: this.organization.meta.defaultStartDate,
            registrationEndDate: this.organization.meta.defaultEndDate,
            prices: this.organization.meta.defaultPrices,
            minAge: 6,
            maxAge: 7
        })
        await kapoenen.save();
        createdGroups.push(kapoenen);

        const jin = new Group()
        jin.organizationId = this.organization.id
        jin.settings = GroupSettings.create({
            name: "Jin",
            genderType: mixedType,
            startDate: this.organization.meta.defaultStartDate,
            endDate: this.organization.meta.defaultEndDate,
            registrationStartDate: this.organization.meta.defaultStartDate,
            registrationEndDate: this.organization.meta.defaultEndDate,
            prices: this.organization.meta.defaultPrices,
            minAge: 17,
            maxAge: 17
        })
        await jin.save();
        createdGroups.push(jin);

        if (this.organization.meta.genderType == OrganizationGenderType.Mixed) {
            const wouters = new Group()
            wouters.organizationId = this.organization.id
            wouters.settings = GroupSettings.create({
                name: "Wouters",
                genderType: GroupGenderType.Mixed,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 8,
                maxAge: 10
            })
            await wouters.save();
            createdGroups.push(wouters);

            const jonggivers = new Group()
            jonggivers.organizationId = this.organization.id
            jonggivers.settings = GroupSettings.create({
                name: "Jonggivers",
                genderType: GroupGenderType.Mixed,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 11,
                maxAge: 13
            })
            await jonggivers.save();
            createdGroups.push(jonggivers);

            const givers = new Group()
            givers.organizationId = this.organization.id
            givers.settings = GroupSettings.create({
                name: "Givers",
                genderType: GroupGenderType.Mixed,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 16
            })
            await givers.save();
            createdGroups.push(givers);
        }

        if (this.organization.meta.genderType == OrganizationGenderType.OnlyFemale || this.organization.meta.genderType == OrganizationGenderType.Separated) {
            const wouters = new Group()
            wouters.organizationId = this.organization.id
            wouters.settings = GroupSettings.create({
                name: "Kabouters",
                genderType: GroupGenderType.OnlyFemale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 8,
                maxAge: 10
            })
            await wouters.save();
            createdGroups.push(wouters);

            const jonggivers = new Group()
            jonggivers.organizationId = this.organization.id
            jonggivers.settings = GroupSettings.create({
                name: "Jonggidsen",
                genderType: GroupGenderType.OnlyFemale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 11,
                maxAge: 13
            })
            await jonggivers.save();
            createdGroups.push(jonggivers);

            const givers = new Group()
            givers.organizationId = this.organization.id
            givers.settings = GroupSettings.create({
                name: "Gidsen",
                genderType: GroupGenderType.OnlyFemale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 16
            })
            await givers.save();
            createdGroups.push(givers);
        }

        if (this.organization.meta.genderType == OrganizationGenderType.OnlyMale || this.organization.meta.genderType == OrganizationGenderType.Separated) {
            const wouters = new Group()
            wouters.organizationId = this.organization.id
            wouters.settings = GroupSettings.create({
                name: "Welpen",
                genderType: GroupGenderType.OnlyMale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 8,
                maxAge: 10
            })
            await wouters.save();
            createdGroups.push(wouters);

            const jonggivers = new Group()
            jonggivers.organizationId = this.organization.id
            jonggivers.settings = GroupSettings.create({
                name: "Jongverkenners",
                genderType: GroupGenderType.OnlyMale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 11,
                maxAge: 13
            })
            await jonggivers.save();
            createdGroups.push(jonggivers);

            const givers = new Group()
            givers.organizationId = this.organization.id
            givers.settings = GroupSettings.create({
                name: "Verkenners",
                genderType: GroupGenderType.OnlyMale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 16
            })
            await givers.save();
            createdGroups.push(givers);
        }

        return createdGroups
    }

    async createChiroGroups() {
        const mixedType = this.organization.meta.genderType == OrganizationGenderType.OnlyMale ? 
        GroupGenderType.OnlyMale : 
            (this.organization.meta.genderType == OrganizationGenderType.OnlyFemale ? 
                GroupGenderType.OnlyFemale : 
                GroupGenderType.Mixed)

        const ribbels = new Group()
        ribbels.organizationId = this.organization.id
        ribbels.settings = GroupSettings.create({
            name: "Ribbels",
            genderType: mixedType,
            startDate: this.organization.meta.defaultStartDate,
            endDate: this.organization.meta.defaultEndDate,
            registrationStartDate: this.organization.meta.defaultStartDate,
            registrationEndDate: this.organization.meta.defaultEndDate,
            prices: this.organization.meta.defaultPrices,
            minAge: 6,
            maxAge: 7
        })
        await ribbels.save();

        const speelclub = new Group()
        speelclub.organizationId = this.organization.id
        speelclub.settings = GroupSettings.create({
            name: "Speelclub",
            genderType: mixedType,
            startDate: this.organization.meta.defaultStartDate,
            endDate: this.organization.meta.defaultEndDate,
            registrationStartDate: this.organization.meta.defaultStartDate,
            registrationEndDate: this.organization.meta.defaultEndDate,
            prices: this.organization.meta.defaultPrices,
            minAge: 8,
            maxAge: 9
        })
        await speelclub.save();


        const aspis = new Group()
        aspis.organizationId = this.organization.id
        aspis.settings = GroupSettings.create({
            name: "Aspi's",
            genderType: mixedType,
            startDate: this.organization.meta.defaultStartDate,
            endDate: this.organization.meta.defaultEndDate,
            registrationStartDate: this.organization.meta.defaultStartDate,
            registrationEndDate: this.organization.meta.defaultEndDate,
            prices: this.organization.meta.defaultPrices,
            minAge: 16,
            maxAge: 17
        })
        await aspis.save();

        if (this.organization.meta.genderType == OrganizationGenderType.Mixed) {
            const rakwis = new Group()
            rakwis.organizationId = this.organization.id
            rakwis.settings = GroupSettings.create({
                name: "Rakwi's",
                genderType: GroupGenderType.Mixed,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 10,
                maxAge: 11
            })
            await rakwis.save();

            const titos = new Group()
            titos.organizationId = this.organization.id
            titos.settings = GroupSettings.create({
                name: "Tito's",
                genderType: GroupGenderType.Mixed,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 12,
                maxAge: 13
            })
            await titos.save();

            const ketis = new Group()
            ketis.organizationId = this.organization.id
            ketis.settings = GroupSettings.create({
                name: "Keti's",
                genderType: GroupGenderType.Mixed,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 15
            })
            await ketis.save();
        }

        if (this.organization.meta.genderType == OrganizationGenderType.OnlyFemale || this.organization.meta.genderType == OrganizationGenderType.Separated) {
            const rakwis = new Group()
            rakwis.organizationId = this.organization.id
            rakwis.settings = GroupSettings.create({
                name: "Kwiks",
                genderType: GroupGenderType.OnlyFemale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 10,
                maxAge: 11
            })
            await rakwis.save();

            const titos = new Group()
            titos.organizationId = this.organization.id
            titos.settings = GroupSettings.create({
                name: "Toppers",
                genderType: GroupGenderType.OnlyFemale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 12,
                maxAge: 13
            })
            await titos.save();

            const ketis = new Group()
            ketis.organizationId = this.organization.id
            ketis.settings = GroupSettings.create({
                name: "Tiptiens",
                genderType: GroupGenderType.OnlyFemale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 15
            })
            await ketis.save();
        }

        if (this.organization.meta.genderType == OrganizationGenderType.OnlyMale || this.organization.meta.genderType == OrganizationGenderType.Separated) {
            const rakwis = new Group()
            rakwis.organizationId = this.organization.id
            rakwis.settings = GroupSettings.create({
                name: "Rakkers",
                genderType: GroupGenderType.OnlyMale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 10,
                maxAge: 11
            })
            await rakwis.save();

            const titos = new Group()
            titos.organizationId = this.organization.id
            titos.settings = GroupSettings.create({
                name: "Tippers",
                genderType: GroupGenderType.OnlyMale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 12,
                maxAge: 13
            })
            await titos.save();

            const ketis = new Group()
            ketis.organizationId = this.organization.id
            ketis.settings = GroupSettings.create({
                name: "Kerels",
                genderType: GroupGenderType.OnlyMale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 15
            })
            await ketis.save();
        }
    }
}