import { Migration } from '@simonbackx/simple-database';
import { AskRequirement, DataPermissionsSettings, File, FilterGroup, FinancialSupportSettings, LegacyRecordType, MemberDetailsWithGroups, OrganizationType, PropertyFilter, RecordConfigurationFactory, RecordFactory } from '@stamhoofd/structures';
import { Organization } from '../models/Organization';
import { STPackage } from '../models/STPackage';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
        if (organization.meta.packages.useMembers) {
            // Does this organization have been used recently or has active member management demo or system?
            const d = organization.meta.recordsConfiguration

            d.recordCategories = []

            if (d.enabledLegacyRecords.find(r => r === LegacyRecordType.FinancialProblems)) {
                d.financialSupport = FinancialSupportSettings.create({})
            } else {
                d.financialSupport = null
            }

            if (d.enabledLegacyRecords.find(r => r === LegacyRecordType.DataPermissions)) {
                d.dataPermission = DataPermissionsSettings.create({})
            } else {
                d.dataPermission = null
            }

            // Convert categories
            if (d.enabledLegacyRecords.length > 0 && d.recordCategories.length == 0) {
                const categories = RecordFactory.convert(d.enabledLegacyRecords)
                d.recordCategories.push(...categories)
            }

            if (d.doctor !== AskRequirement.NotAsked) {
                d.recordCategories.push(RecordFactory.createDoctorCategory(d.doctor === AskRequirement.Required))
            }

            if (d.emergencyContact !== AskRequirement.NotAsked) {
                const definitions = MemberDetailsWithGroups.getBaseFilterDefinitions()
                d.emergencyContacts = new PropertyFilter(new FilterGroup(definitions), d.emergencyContact === AskRequirement.Required ? new FilterGroup(definitions) : null)
            } else {
                d.emergencyContacts = null
            }

            // For all existing users, keep the same defaults as youth, because they are already using the system. Don't want to change the configurations here
            RecordConfigurationFactory.setDefaultBuiltInFields(d, OrganizationType.Youth)
            RecordConfigurationFactory.setDefaultParents(d, OrganizationType.Youth)

            d.enabledLegacyRecords = []
        } else {
            // Use defaults as when creating a new organization
            organization.meta.recordsConfiguration = RecordConfigurationFactory.create(organization.meta.type, organization.address.country)
        }
        
        await organization.save()
    }
});


