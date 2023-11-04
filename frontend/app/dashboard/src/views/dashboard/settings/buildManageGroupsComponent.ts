import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, } from "@simonbackx/vue-app-navigation";
import { GroupCategory, GroupCategorySettings,GroupCategoryTree, Organization, OrganizationMetaData, OrganizationTypeHelper } from "@stamhoofd/structures";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import EditCategoryGroupsView from '../groups/EditCategoryGroupsView.vue';

// You can declare mixins as the same style as components.
export function buildManageGroupsComponent(organization: Organization) {
    const enableActivities = organization.meta.modules.useActivities

    if (!organization.meta.rootCategory) {
        // Auto restore missing root category
        const category = GroupCategory.create({})
        const meta = OrganizationMetaData.patch({
            rootCategoryId: category.id
        })
        meta.categories.addPut(category)

        const p = Organization.patch({
            id: organization.id,
            meta
        })
        
        return new ComponentWithProperties(EditCategoryGroupsView, { 
            category: category, 
            organization: organization.patch(p), 
            saveHandler: async (patch: AutoEncoderPatchType<Organization>) => {
                patch.id = organization.id
                await OrganizationManager.patch(p.patch(patch))
            }
        })
    }

    let cat = organization.meta.rootCategory

    let p = Organization.patch({
        id: organization.id
    })

    if (!enableActivities) {
        const full = GroupCategoryTree.build(cat, organization)
        if (full.categories.length === 0) {

            // Create a new one and open that one instead
            const defaultCategories = OrganizationTypeHelper.getDefaultGroupCategoriesWithoutActivities(organization.meta.type, organization.meta.umbrellaOrganization ?? undefined)
            const category = defaultCategories[0] ?? GroupCategory.create({
                settings: GroupCategorySettings.create({
                    name: "Leeftijdsgroepen",
                    
                })
            })
            category.groupIds = organization.groups.map(g => g.id)
            
            const meta = OrganizationMetaData.patch({})
            meta.categories.addPut(category)

            const me = GroupCategory.patch({ id: cat.id })
            me.categoryIds.addPut(category.id)
            meta.categories.addPatch(me)

            p = p.patch({
                meta
            })

            cat = category

        } else {
            cat = full.categories[0]
        }
    }
    return new ComponentWithProperties(EditCategoryGroupsView, {
        category: cat,
        organization: organization.patch(p),
        saveHandler: async (patch) => {
            patch.id = organization.id
            await OrganizationManager.patch(p.patch(patch))
        }
    })
}

