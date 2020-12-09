import { GroupGenderType, GroupSettings, OrganizationGenderType, OrganizationType, UmbrellaOrganization } from '@stamhoofd/structures'

import { Group } from '../models/Group'
import { Organization } from '../models/Organization'

export class GroupBuilder {
    organization: Organization

    constructor(organization: Organization) {
        this.organization = organization
    }

    async build() {
        const groups = await Group.where({ organizationId: this.organization.id })

        if (groups.length > 0) {
            // Do not add new groups
            return
        }

        // Setup default groups if possible
        if (this.organization.meta.type == OrganizationType.Youth && this.organization.meta.umbrellaOrganization == UmbrellaOrganization.ScoutsEnGidsenVlaanderen) {
            await this.createSGVGroups()
        } else if (this.organization.meta.type == OrganizationType.Youth && this.organization.meta.umbrellaOrganization == UmbrellaOrganization.ChiroNationaal) {
            await this.createChiroGroups()
        }
    }
    
    async createSGVGroups() {
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
            prices: this.organization.meta.defaultPrices,
            minAge: 6,
            maxAge: 7
        })
        await kapoenen.save();

        const jin = new Group()
        jin.organizationId = this.organization.id
        jin.settings = GroupSettings.create({
            name: "Jin",
            genderType: mixedType,
            startDate: this.organization.meta.defaultStartDate,
            endDate: this.organization.meta.defaultEndDate,
            prices: this.organization.meta.defaultPrices,
            minAge: 17,
            maxAge: 17
        })
        await jin.save();

        if (this.organization.meta.genderType == OrganizationGenderType.Mixed) {
            const wouters = new Group()
            wouters.organizationId = this.organization.id
            wouters.settings = GroupSettings.create({
                name: "Wouters",
                genderType: GroupGenderType.Mixed,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 8,
                maxAge: 10
            })
            await wouters.save();

            const jonggivers = new Group()
            jonggivers.organizationId = this.organization.id
            jonggivers.settings = GroupSettings.create({
                name: "Jonggivers",
                genderType: GroupGenderType.Mixed,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 11,
                maxAge: 13
            })
            await jonggivers.save();

            const givers = new Group()
            givers.organizationId = this.organization.id
            givers.settings = GroupSettings.create({
                name: "Givers",
                genderType: GroupGenderType.Mixed,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 16
            })
            await givers.save();
        }

        if (this.organization.meta.genderType == OrganizationGenderType.OnlyFemale || this.organization.meta.genderType == OrganizationGenderType.Separated) {
            const wouters = new Group()
            wouters.organizationId = this.organization.id
            wouters.settings = GroupSettings.create({
                name: "Kabouters",
                genderType: GroupGenderType.OnlyFemale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 8,
                maxAge: 10
            })
            await wouters.save();

            const jonggivers = new Group()
            jonggivers.organizationId = this.organization.id
            jonggivers.settings = GroupSettings.create({
                name: "Jonggidsen",
                genderType: GroupGenderType.OnlyFemale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 11,
                maxAge: 13
            })
            await jonggivers.save();

            const givers = new Group()
            givers.organizationId = this.organization.id
            givers.settings = GroupSettings.create({
                name: "Gidsen",
                genderType: GroupGenderType.OnlyFemale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 16
            })
            await givers.save();
        }

        if (this.organization.meta.genderType == OrganizationGenderType.OnlyMale || this.organization.meta.genderType == OrganizationGenderType.Separated) {
            const wouters = new Group()
            wouters.organizationId = this.organization.id
            wouters.settings = GroupSettings.create({
                name: "Welpen",
                genderType: GroupGenderType.OnlyMale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 8,
                maxAge: 10
            })
            await wouters.save();

            const jonggivers = new Group()
            jonggivers.organizationId = this.organization.id
            jonggivers.settings = GroupSettings.create({
                name: "Jongverkenners",
                genderType: GroupGenderType.OnlyMale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 11,
                maxAge: 13
            })
            await jonggivers.save();

            const givers = new Group()
            givers.organizationId = this.organization.id
            givers.settings = GroupSettings.create({
                name: "Verkenners",
                genderType: GroupGenderType.OnlyMale,
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 16
            })
            await givers.save();
        }
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
                prices: this.organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 15
            })
            await ketis.save();
        }
    }
}