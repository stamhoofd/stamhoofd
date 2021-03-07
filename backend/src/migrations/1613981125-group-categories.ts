import { Migration } from '@simonbackx/simple-database';
import { GroupCategory, OrganizationTypeHelper } from '@stamhoofd/structures';
import { Group } from '../models/Group';
import { Organization } from '../models/Organization';
import { Group as GroupStruct } from "@stamhoofd/structures";

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
        // Setup default root groups
        if (organization.meta.modules.useMembers && organization.meta.categories.length <= 1) {
            console.log(organization.name)

            const groups = await Group.where({ organizationId: organization.id })
            const sortedGroupIds = groups.map(g => GroupStruct.create(Object.assign({}, g, { privateSettings: null }))).sort(GroupStruct.defaultSort).map(g => g.id)

            const defaults = OrganizationTypeHelper.getDefaultGroupCategories(organization.meta.type, organization.meta.umbrellaOrganization ?? undefined)

            organization.meta.categories.push(...defaults)

            // Only assign categories that are at the top level to the root category
            const filter = defaults.flatMap(d => d.categoryIds)
            organization.meta.rootCategory?.categoryIds.push(...defaults.map(d => d.id).filter(id => !filter.includes(id)))

            if (defaults.length > 0) {
                defaults[0].groupIds.push(...sortedGroupIds)
            } else {
                organization.meta.rootCategory!.groupIds.push(...sortedGroupIds)
            }

            await organization.save()
        }
        
    }
});


