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
        // Loop groups
        const groups = await Group.where({ organizationId: organization.id })

        for (const group of groups) {
            // Check if parent has minimum
            await group.updateOccupancy()
            await group.save()
        }
    }
});


