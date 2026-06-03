import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { GroupCategory, GroupCategorySettings, GroupCategoryTree, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings, OrganizationTypeHelper } from '@stamhoofd/structures';

import { PromiseComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { useLoadRecentPeriods } from '@stamhoofd/networking/hooks/useLoadRecentPeriods';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriods';
import EditCategoryGroupsView from '../../groups/EditCategoryGroupsView.vue';

// You can declare mixins as the same style as components.
export function useEditGroupsView() {
    const o = useOrganization();
    const patchOrganizationPeriods = usePatchOrganizationPeriods();
    const getPeriods = useLoadRecentPeriods();

    return async function () {
        const organization = o.value;
        if (!organization) {
            throw new Error('Organization is not defined');
        }
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

            return PromiseComponent(async () => {
                const periods = (await getPeriods()).map((x) => {
                    if (x.id === period.id) {
                        return x.patch(p);
                    }
                    return x;
                });
                return new ComponentWithProperties(EditCategoryGroupsView, {
                    periodId: period.id,
                    periods,
                    category: category,
                    organization,
                    isNew: false,
                    saveHandler: async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                        await patchOrganizationPeriods(patch, { periods });
                    },
                });
            });
        }

        const cat = period.settings.rootCategory;

        const p = OrganizationRegistrationPeriod.patch({
            id: period.id,
        });

        return PromiseComponent(
            async () => {
                const periods = (await getPeriods()).map((x) => {
                    if (x.id === period.id) {
                        return x.patch(p);
                    }
                    return x;
                });
                return new ComponentWithProperties(EditCategoryGroupsView, {
                    periodId: period.id,
                    periods,
                    category: cat,
                    organization,
                    isNew: false,
                    saveHandler: async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                        await patchOrganizationPeriods(patch, { periods });
                    },
                });
            },
        );
    };
}
