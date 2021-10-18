import { Migration } from '@simonbackx/simple-database';
import { Organization } from '../models/Organization';

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
        for (const record of organization.meta.recordsConfiguration.recordCategories.flatMap(c => c.getAllRecords())) {
            if (record.warning) {
                record.warning.text = record.warning.text.replace("afgelopepn", "afgelopen")
            }
        }
        
        await organization.save()
    }
});


