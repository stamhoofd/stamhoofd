import { Migration } from '@simonbackx/simple-database';
import { QueueHandler } from '@stamhoofd/queues';
import { Organization } from '../models/Organization';
import { STPackage } from '../models/STPackage';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
        QueueHandler.schedule("migration", async () => {
            await STPackage.updateOrganizationPackages(organization.id)
        }, 25).catch(console.error);
    }

    await QueueHandler.schedule("migration", async () => {
        console.log("Done")
        return Promise.resolve()
    }, 25);
});


