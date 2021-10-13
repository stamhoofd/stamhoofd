import { ChoicesFilterDefinition } from "../../filters/ChoicesFilter"
import { FilterGroup, GroupFilterMode } from "../../filters/FilterGroup"
import { NumberFilterDefinition, NumberFilterMode } from "../../filters/NumberFilter"
import { PropertyFilter } from "../../filters/PropertyFilter"
import { OrganizationType } from "../../OrganizationType"
import { MemberDetails } from "../MemberDetails"
import { DataPermissionsSettings, MemberDetailsWithGroups, OrganizationRecordsConfiguration } from "../OrganizationRecordsConfiguration"
import { LegacyRecordType } from "./LegacyRecordType"
import { RecordCategory } from "./RecordCategory"
import { RecordFactory } from "./RecordFactory"

export class RecordConfigurationFactory {
    static create(type: OrganizationType): OrganizationRecordsConfiguration {
        const recordCategories = this.getDefaultRecordCategoriesFor(type)
        const configuration = OrganizationRecordsConfiguration.create({
            recordCategories,
        })

        this.setDefaultBuiltInFields(configuration, type)
        this.setDefaultParents(configuration, type)
        this.setDefaultEmergencyContacts(configuration, type)
        this.setDefaultDataPermissions(configuration, type)

        return configuration
    }

    /**
     * Set default email, phone, partents, ... configuration
     * Except emergency contacts
     */
    static setDefaultBuiltInFields(configuration: OrganizationRecordsConfiguration, type: OrganizationType) {
        // Every organization types uses these defaults
        const detailsDefinitions = MemberDetails.getBaseFilterDefinitions()

        // Phone number is asked for +11, and only required for +18
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const ageDef = detailsDefinitions.find(d => d.id == "member_age")! as NumberFilterDefinition<MemberDetails>

        const plus18Filter = ageDef.createFilter()
        plus18Filter.mode = NumberFilterMode.GreaterThan
        plus18Filter.start = 18

        const plus11Filter = ageDef.createFilter()
        plus11Filter.mode = NumberFilterMode.GreaterThan
        plus11Filter.start = 11

        configuration.phone = new PropertyFilter(new FilterGroup(detailsDefinitions, [plus11Filter]), new FilterGroup(detailsDefinitions, [plus18Filter]))
        configuration.emailAddress = new PropertyFilter(new FilterGroup(detailsDefinitions, [plus11Filter]), new FilterGroup(detailsDefinitions, [plus18Filter]))

        // Only make address optional for youth and sport organizations for now
        if (type === OrganizationType.Youth || [OrganizationType.Student ,OrganizationType.Sport, OrganizationType.Athletics, OrganizationType.Football, OrganizationType.Hockey, OrganizationType.Tennis, OrganizationType.Volleyball, OrganizationType.Swimming, OrganizationType.HorseRiding, OrganizationType.Basketball, OrganizationType.Dance, OrganizationType.Cycling, OrganizationType.Judo].includes(type)) {
            const plus26Filter = ageDef.createFilter()
            plus18Filter.mode = NumberFilterMode.GreaterThan
            plus18Filter.start = 26

            configuration.address = new PropertyFilter(new FilterGroup(detailsDefinitions, [plus18Filter]), new FilterGroup(detailsDefinitions, [plus26Filter]))
        }
    }

    static setDefaultParents(configuration: OrganizationRecordsConfiguration, type: OrganizationType) {
        // For now, only enable parents for youth and sport organizations
        if (type === OrganizationType.Youth || [OrganizationType.Student ,OrganizationType.Sport, OrganizationType.Athletics, OrganizationType.Football, OrganizationType.Hockey, OrganizationType.Tennis, OrganizationType.Volleyball, OrganizationType.Swimming, OrganizationType.HorseRiding, OrganizationType.Basketball, OrganizationType.Dance, OrganizationType.Cycling, OrganizationType.Judo].includes(type)) {
            const definitions = MemberDetailsWithGroups.getBaseFilterDefinitions()
            const ageDef = definitions.find(d => d.id == "member_age")! as NumberFilterDefinition<MemberDetailsWithGroups>
            const missingFilter = definitions.find(d => d.id == "member_missing_data")! as ChoicesFilterDefinition<MemberDetailsWithGroups>

            const minus18Filter = ageDef.createFilter()
            minus18Filter.mode = NumberFilterMode.LessThan
            minus18Filter.end = 18

            const minus26Filter = ageDef.createFilter()
            minus26Filter.mode = NumberFilterMode.LessThan
            minus26Filter.end = 26

            const addressMissingFilter = missingFilter.createFilter()
            addressMissingFilter.choiceIds = ["address"]

            configuration.parents = new PropertyFilter(
                new FilterGroup(definitions, [minus26Filter]), 
                new FilterGroup(definitions, [minus18Filter, addressMissingFilter], GroupFilterMode.Or)
            )
        }
    }

    static setDefaultEmergencyContacts(configuration: OrganizationRecordsConfiguration, type: OrganizationType) {
        const definitions = MemberDetailsWithGroups.getBaseFilterDefinitions()

        // For now, only enable parents for youth and sport organizations
        if (type === OrganizationType.Youth || [OrganizationType.Student ,OrganizationType.Sport, OrganizationType.Athletics, OrganizationType.Football, OrganizationType.Hockey, OrganizationType.Tennis, OrganizationType.Volleyball, OrganizationType.Swimming, OrganizationType.HorseRiding, OrganizationType.Basketball, OrganizationType.Dance, OrganizationType.Cycling, OrganizationType.Judo].includes(type)) {
            const ageDef = definitions.find(d => d.id == "member_age")! as NumberFilterDefinition<MemberDetailsWithGroups>
            const missingFilter = definitions.find(d => d.id == "member_missing_data")! as ChoicesFilterDefinition<MemberDetailsWithGroups>

            const minus18Filter = ageDef.createFilter()
            minus18Filter.mode = NumberFilterMode.LessThan
            minus18Filter.end = 18

            const minus26Filter = ageDef.createFilter()
            minus26Filter.mode = NumberFilterMode.LessThan
            minus26Filter.end = 26

            const parentsMissingFilter = missingFilter.createFilter()
            parentsMissingFilter.choiceIds = ["parents"]

            configuration.emergencyContacts = new PropertyFilter(
                new FilterGroup(definitions, [minus26Filter]), 
                new FilterGroup(definitions, [minus18Filter, parentsMissingFilter], GroupFilterMode.Or)
            )
        } else if (type === OrganizationType.LGBTQ) {
            // Optional emergency contact
            configuration.emergencyContacts = new PropertyFilter(
                new FilterGroup(definitions), 
                null
            )
        }
    }

    static setDefaultDataPermissions(configuration: OrganizationRecordsConfiguration, type: OrganizationType) {
        // For now, only enable parents for youth and sport organizations
        if (configuration.recordCategories.flatMap(c => c.getAllRecords()).find(r => r.sensitive)) {
            configuration.dataPermission = DataPermissionsSettings.create({})
        }

        if (type === OrganizationType.LGBTQ || type === OrganizationType.Politics || type === OrganizationType.Union) {
            // Sensitive membership: need to ask permission
            configuration.dataPermission = DataPermissionsSettings.create({})
        }
    }

    static getDefaultRecordCategoriesFor(type: OrganizationType): RecordCategory[] {
        if (type === OrganizationType.Youth) {
            // Enable all
            const recordCategories = RecordFactory.convert(Object.values(LegacyRecordType))

            // Ask doctor (required)
            recordCategories.push(RecordFactory.createDoctorCategory(true))

            return recordCategories
        }

        // Others are all disabled by default
        return []
    }
}