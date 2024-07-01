import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, } from "@simonbackx/vue-app-navigation";
import { OrganizationManager } from "@stamhoofd/networking";
import { GroupCategory, GroupCategorySettings, GroupCategoryTree, Organization, OrganizationMetaData, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings, OrganizationTypeHelper } from "@stamhoofd/structures";

import EditCategoryGroupsView from '../groups/EditCategoryGroupsView.vue';

// You can declare mixins as the same style as components.
export function buildManageGroupsComponent($organizationManager: OrganizationManager) {
    const organization = $organizationManager.organization
    const enableActivities = organization.meta.modules.useActivities
    const period = organization.period

    if (!period.settings.rootCategory) {
        // Auto restore missing root category
        const category = GroupCategory.create({})
        const settings = OrganizationRegistrationPeriodSettings.patch({
            rootCategoryId: category.id
        })
        settings.categories.addPut(category)

        const p = OrganizationRegistrationPeriod.patch({
            id: period.id,
            settings
        })
        
        return new ComponentWithProperties(EditCategoryGroupsView, { 
            period: period.patch(p),
            category: category, 
            organization, 
            isNew: false,
            saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {     
                patch.id = period.id           
                // todo
            }
        })
    }

    let cat = period.settings.rootCategory

    let p = OrganizationRegistrationPeriod.patch({
        id: period.id
    })

    if (!enableActivities) {
        const full = GroupCategoryTree.build(cat, period)
        if (full.categories.length === 0) {

            // Create a new one and open that one instead
            const defaultCategories = OrganizationTypeHelper.getDefaultGroupCategoriesWithoutActivities(organization.meta.type, organization.meta.umbrellaOrganization ?? undefined)
            const category = defaultCategories[0] ?? GroupCategory.create({
                settings: GroupCategorySettings.create({
                    name: "Leeftijdsgroepen",
                    
                })
            })
            category.groupIds = period.groups.map(g => g.id)
            
            const settings = OrganizationRegistrationPeriodSettings.patch({})
            settings.categories.addPut(category)

            const me = GroupCategory.patch({ id: cat.id })
            me.categoryIds.addPut(category.id)
            settings.categories.addPatch(me)

            p = p.patch({
                settings
            })

            cat = category

        } else {
            cat = full.categories[0]
        }
    }
    return new ComponentWithProperties(EditCategoryGroupsView, {
        period: period.patch(p),
        category: cat,
        organization,
        isNew: false,
        saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
            patch.id = period.id
            await $organizationManager.patchPeriods(patch)
        }
    })
}

