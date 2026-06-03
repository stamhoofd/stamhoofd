import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { PromiseComponent, useRequiredOrganization } from '@stamhoofd/components';
import { useLoadRecentPeriods } from '@stamhoofd/networking/hooks/useLoadRecentPeriods';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriods';
import { GroupCategory, GroupCategorySettings, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';
import EditCategoryGroupsView from '../../groups/EditCategoryGroupsView.vue';

export function useCreateCategoryView(saveHandler?: (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => Promise<void> | void) {
    const present = usePresent();
    const organization = useRequiredOrganization();
    const patchOrganizationPeriods = usePatchOrganizationPeriods();
    const getPeriods = useLoadRecentPeriods();

    return async function createCategory(period: OrganizationRegistrationPeriod, parentCategory: GroupCategory, periods?: OrganizationRegistrationPeriod[]) {
        const category = GroupCategory.create({});

        const settings = OrganizationRegistrationPeriodSettings.patch({});
        settings.categories.addPut(category);

        const me = GroupCategory.patch({
            id: parentCategory.id,
        });

        // When the parent already contains groups, we can't keep those groups next to the new
        // subcategory. Move all existing groups into a dedicated new category (named after the
        // parent, or 'Leeftijdsgroepen' for the root) so the parent only contains categories.
        if (parentCategory.groupIds.length > 0) {
            const groupsCategory = GroupCategory.create({
                settings: GroupCategorySettings.create({
                    name: parentCategory.getName(),
                }),
                groupIds: [...parentCategory.groupIds],
            });
            settings.categories.addPut(groupsCategory);
            me.categoryIds.addPut(groupsCategory.id);
            me.groupIds = [] as any;
        }

        me.categoryIds.addPut(category.id);
        settings.categories.addPatch(me);

        const p = OrganizationRegistrationPeriod.patch({
            id: period.id,
            settings,
        });

        const arr: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod> = new PatchableArray();
        arr.addPatch(p);

        await present({
            components: [
                PromiseComponent(
                    async () => {
                        const unpatchedPeriods = periods ?? (await getPeriods(period));
                        const loadedPeriods = arr.applyTo(unpatchedPeriods);

                        if (!loadedPeriods.find(p => p.id === period.id)) {
                            console.error('periods', loadedPeriods);
                            throw new Error('Uneexpected missing period in periods list');
                        }

                        return new ComponentWithProperties(EditCategoryGroupsView, {
                            category: category,
                            organization: organization.value,
                            periods: loadedPeriods,
                            period,
                            isNew: true,
                            saveHandler: (saveHandler
                                ? async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                                    await saveHandler(arr.patch(patch));
                                }
                                : null) ?? (async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                                await patchOrganizationPeriods(arr.patch(patch), { periods: unpatchedPeriods });
                            }),
                        });
                    },
                ),
            ],
            modalDisplayStyle: 'popup',
        });
    };
}
