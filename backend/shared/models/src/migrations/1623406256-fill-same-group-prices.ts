import { Migration } from '@simonbackx/simple-database';
import { Group } from '../models/Group';
import { Organization } from '../models/Organization';

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
        // Loop groups
        const groups = await Group.where({ organizationId: organization.id })

        for (const group of groups) {
            // Check if parent has minimum
            let onlySameGroup = true

            const parents = group.getStructure().getParentCategories(organization.meta.categories, false)
            for (const parent of parents) {
                if (parent.settings.maximumRegistrations === 1) {
                    onlySameGroup = false
                    break;
                }
            }

            for (const price of group.settings.prices) {
                price.onlySameGroup = onlySameGroup
            }
            console.log(organization.name+" - " + group.settings.name +": "+onlySameGroup)
            await group.save()
        }
    }
});


