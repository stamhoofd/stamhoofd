import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { GroupCategory, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';

import { PromiseComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { useLoadRecentPeriods } from '@stamhoofd/networking/hooks/useLoadRecentPeriods';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriods';

// You can declare mixins as the same style as components.
export function useEditGroupsView() {
    const o = useOrganization();
    const patchOrganizationPeriods = usePatchOrganizationPeriods();
    const getPeriods = useLoadRecentPeriods();

    return function (period: OrganizationRegistrationPeriod, category?: GroupCategory) {
        const organization = o.value;
        if (!organization) {
            throw new Error('Organization is not defined');
        }

        if (!category && !period.settings.rootCategory) {
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
                const { default: EditCategoryGroupsView } = await import('../../groups/EditCategoryGroupsView.vue');
                const periods = (await getPeriods(period)).map((x) => {
                    if (x.id === period.id) {
                        return x.patch(p);
                    }
                    return x;
                });
                return new ComponentWithProperties(EditCategoryGroupsView, {
                    period: period,
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

        const cat = category ?? period.settings.rootCategory;

        const p = OrganizationRegistrationPeriod.patch({
            id: period.id,
        });

        return PromiseComponent(
            async () => {
                const { default: EditCategoryGroupsView } = await import('../../groups/EditCategoryGroupsView.vue');
                const periods = (await getPeriods(period)).map((x) => {
                    if (x.id === period.id) {
                        return x.patch(p);
                    }
                    return x;
                });

                if (!periods.find(p => p.id === period.id)) {
                    throw new Error('Uneexpected missing period in periods list');
                }

                return new ComponentWithProperties(EditCategoryGroupsView, {
                    period,
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
