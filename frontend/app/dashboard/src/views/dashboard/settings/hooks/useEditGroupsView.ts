import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { GroupCategory, GroupCategorySettings, GroupCategoryTree, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings, OrganizationTypeHelper } from '@stamhoofd/structures';

import { PromiseComponent, useOrganization } from '@stamhoofd/components';
import { useGetPeriods, usePatchOrganizationPeriods } from '@stamhoofd/networking';
import EditCategoryGroupsView from '../../groups/EditCategoryGroupsView.vue';

// You can declare mixins as the same style as components.
export function useEditGroupsView() {
    const o = useOrganization();
    const patchOrganizationPeriods = usePatchOrganizationPeriods();
    const getPeriods = useGetPeriods();

    return async function () {
        const organization = o.value;
        if (!organization) {
            throw new Error('Organization is not defined');
        }
        const enableActivities = organization.meta.modules.useActivities;
        const period = organization.period;

        if (!period.settings.rootCategory) {
            // Auto restore missing root category
            const category = GroupCategory.create({});
            const settings = OrganizationRegistrationPeriodSettings.patch({
                rootCategoryId: category.id,
            });
            settings.categories.addPut(category);

            const p = OrganizationRegistrationPeriod.patch({
                id: period.id,
                settings,
            });

            return PromiseComponent(async () => new ComponentWithProperties(EditCategoryGroupsView, {
                periodId: period.id,
                periods: (await getPeriods()).map((x) => {
                    if (x.id === period.id) {
                        return x.patch(p);
                    }
                    return x;
                }),
                category: category,
                organization,
                isNew: false,
                saveHandler: async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                    await patchOrganizationPeriods(patch);
                },
            }));
        }

        let cat = period.settings.rootCategory;

        let p = OrganizationRegistrationPeriod.patch({
            id: period.id,
        });

        if (!enableActivities) {
            const full = GroupCategoryTree.build(cat, period);
            if (full.categories.length === 0) {
            // Create a new one and open that one instead
                const defaultCategories = OrganizationTypeHelper.getDefaultGroupCategoriesWithoutActivities(organization.meta.type, organization.meta.umbrellaOrganization ?? undefined);
                const category = defaultCategories[0] ?? GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: $t(`5271f407-ec58-4802-ac69-7f357bc3cfc7`),

                    }),
                });
                category.groupIds = period.groups.map(g => g.id);

                const settings = OrganizationRegistrationPeriodSettings.patch({});
                settings.categories.addPut(category);

                const me = GroupCategory.patch({ id: cat.id });
                me.categoryIds.addPut(category.id);
                settings.categories.addPatch(me);

                p = p.patch({
                    settings,
                });

                cat = category;
            }
            else {
                cat = full.categories[0];
            }
        }
        return PromiseComponent(async () => new ComponentWithProperties(EditCategoryGroupsView, {
            periodId: period.id,
            periods: (await getPeriods()).map((x) => {
                if (x.id === period.id) {
                    return x.patch(p);
                }
                return x;
            }),
            category: cat,
            organization,
            isNew: false,
            saveHandler: async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                await patchOrganizationPeriods(patch);
            },
        }));
    };
}
