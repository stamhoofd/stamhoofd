import { Migration } from '@simonbackx/simple-database';
import { AskRequirement, DataPermissionsSettings, File, FilterGroup, FinancialSupportSettings, LegacyRecordType, MemberDetailsWithGroups, PropertyFilter, RecordFactory } from '@stamhoofd/structures';
import { Organization } from '../models/Organization';

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
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

        d.enabledLegacyRecords = []
        await organization.save()
    }
});


