import { Migration } from '@simonbackx/simple-database';
import { Group } from '../models/Group';
import { Organization } from '../models/Organization';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
        await Group.deleteUnreachable(organization.id, organization.meta)
    }
});


