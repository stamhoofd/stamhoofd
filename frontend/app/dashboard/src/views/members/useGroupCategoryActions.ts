import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { useLoadRecentPeriods } from '@stamhoofd/networking/hooks/useLoadRecentPeriods';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriods';
import { GroupCategory, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';
import { useCreateCategoryView } from '../dashboard/settings/hooks/useCreateCategoryView';
import { useCreateGroupView } from '../dashboard/settings/hooks/useCreateGroupView';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';

/**
 * Actions for a single group category (edit, create, reorder, move, merge, delete).
 *
 * By default the changes are saved straight to the API. Pass a `saveHandler` to keep the
 * patch in memory instead (e.g. when collecting multiple changes before saving them in one go).
 */
export function useGroupCategoryActions(saveHandler?: (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => Promise<void> | void) {
    const present = usePresent();
    const auth = useAuth();
    const organization = useRequiredOrganization();
    const patchOrganizationPeriods = usePatchOrganizationPeriods();
    const getPeriods = useLoadRecentPeriods();
    const createCategoryView = useCreateCategoryView(saveHandler);
    const createGroupView = useCreateGroupView(saveHandler
        ? async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
            const arr = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>;
            arr.addPatch(patch);
            await saveHandler(arr);
        }
        : undefined);
    const isPlatformAdmin = auth.hasFullPlatformAccess();

    return function getFor(props: {
        period: OrganizationRegistrationPeriod;
        category: GroupCategory;
        /**
         * The periods used when editing the category. Fetched automatically when not provided.
         */
        periods?: OrganizationRegistrationPeriod[];
    }) {
        function getParentCategory() {
            return props.category.getParentCategories(props.period.settings.categories)[0];
        }

        function getGrandParentCategory(): GroupCategory | undefined {
            return getParentCategory()?.getParentCategories(props.period.settings.categories)[0];
        }

        function getSubCategories() {
            return getParentCategory().categoryIds
                .map(id => props.period.settings.categories.find(c => c.id === id)!)
                .filter(c => c && c.id !== props.category.id);
        }

        const canDeleteOrRename = props.category.settings.locked !== true || isPlatformAdmin;

        async function save(patches: AutoEncoderPatchType<OrganizationRegistrationPeriod>[], periods: OrganizationRegistrationPeriod[]) {
            const arr = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>;
            for (const patch of patches) {
                arr.addPatch(patch);
            }

            if (saveHandler) {
                await saveHandler(arr);
                return;
            }

            await patchOrganizationPeriods(arr, { periods });
        }

        // Only notify when saving directly to the API, otherwise the change is collected in memory
        function showSuccessToast(message: string) {
            if (!saveHandler) {
                Toast.success(message).show();
            }
        }

        async function editCategory() {
            const periods = props.periods ?? await getPeriods(props.period);

            await present({
                components: [
                    AsyncComponent(() => import('../dashboard/groups/EditCategoryGroupsView.vue'), {
                        category: props.category,
                        organization: organization.value,
                        period: props.period,
                        periods,
                        isNew: false,
                        saveHandler: async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                            if (saveHandler) {
                                await saveHandler(patch);
                                return;
                            }
                            await patchOrganizationPeriods(patch, { periods });
                        },
                    }),
                ],
                modalDisplayStyle: 'popup',
            });
        }

        async function createCategory() {
            await createCategoryView(props.period, props.category, props.periods);
        }

        async function createGroup() {
            await createGroupView(props.period, props.category);
        }

        // Reorder the category within its parent (offset -1 = up, +1 = down)
        async function move(offset: -1 | 1) {
            const parentCategory = getParentCategory();
            const ids = parentCategory.categoryIds;
            const index = ids.findIndex(id => id === props.category.id);
            if (index === -1) {
                return;
            }
            if (offset === -1 && index === 0) {
                return;
            }
            if (offset === 1 && index >= ids.length - 1) {
                return;
            }

            const targetIndex = offset === -1 ? index - 2 : index + 1;
            const reorder = new PatchableArray() as PatchableArray<string, string, string>;
            reorder.addMove(props.category.id, ids[targetIndex] ?? null);

            const settings = OrganizationRegistrationPeriodSettings.patch({});
            settings.categories.addPatch(GroupCategory.patch({ id: parentCategory.id, categoryIds: reorder }));

            await save([OrganizationRegistrationPeriod.patch({ id: props.period.id, settings })], [props.period]);
        }

        async function moveTo(category: GroupCategory) {
            // Only confirm when saving directly to the API, otherwise the change is collected in memory
            if (!saveHandler && !await CenteredMessage.confirm({
                title: $t('%1ZA', {
                    categoryName: props.category.getName(props.period),
                    destinationName: category.getName(props.period),
                }),
                confirmText: $t('%10t'),
            })) {
                return;
            }

            const p = GroupCategory.patch({ id: category.id });
            p.categoryIds.addPut(props.category.id);

            const settings = OrganizationRegistrationPeriodSettings.patch({});
            settings.categories.addPatch(p);

            const pp = GroupCategory.patch({ id: getParentCategory().id });
            pp.categoryIds.addDelete(props.category.id);
            settings.categories.addPatch(pp);

            await save([OrganizationRegistrationPeriod.patch({ id: props.period.id, settings })], [props.period]);

            showSuccessToast($t('%1YP', {
                categoryName: props.category.getName(props.period),
                destinationName: category.getName(props.period),
            }));
        }

        function mergeDisabledWith(category: GroupCategory): boolean | string {
            if (props.category.groupIds.length === 0 && props.category.categoryIds.length === 0) {
                return $t('%1Zc');
            }

            // Ignore own category id
            const filteredCategoryIds = category.categoryIds.filter(id => id !== props.category.id);

            if (category.groupIds.length === 0 && filteredCategoryIds.length === 0) {
                return false;
            }

            if (category.groupIds.length > 0) {
                if (props.category.categoryIds.length > 0) {
                    return $t('%1aX', {
                        'category': category.getName(props.period),
                        'other-category': props.category.getName(props.period),
                    });
                }
                return false;
            }

            if (props.category.groupIds.length > 0) {
                return $t('%1af', {
                    'category': category.getName(props.period),
                    'other-category': props.category.getName(props.period),
                });
            }
            return false;
        }

        async function mergeWith(category: GroupCategory, destinationName: string) {
            // Only confirm when saving directly to the API, otherwise the change is collected in memory
            if (!saveHandler && !await CenteredMessage.confirm({
                title: $t('%1WJ', { destinationName }),
                confirmText: $t('%55'),
                destructive: true,
            })) {
                return;
            }

            const p = GroupCategory.patch({ id: category.id });
            for (const childCatId of props.category.categoryIds) {
                p.categoryIds.addPut(childCatId);
            }
            for (const childGroupId of props.category.groupIds) {
                p.groupIds.addPut(childGroupId);
            }

            const settings = OrganizationRegistrationPeriodSettings.patch({});
            settings.categories.addPatch(p);

            const pp = GroupCategory.patch({ id: getParentCategory().id });
            pp.categoryIds.addDelete(props.category.id);
            settings.categories.addPatch(pp);

            await save([OrganizationRegistrationPeriod.patch({ id: props.period.id, settings })], [props.period]);

            showSuccessToast($t('%1YI', {
                categoryName: props.category.getName(props.period),
                destinationName,
            }));
        }

        async function deleteMe() {
            // Only confirm when saving directly to the API, otherwise the change is collected in memory
            if (!saveHandler && !await CenteredMessage.confirm({
                title: $t('%1aZ', {
                    categoryName: props.category.getName(props.period),
                }),
                confirmText: $t('%55'),
                destructive: true,
            })) {
                return;
            }

            const settings = OrganizationRegistrationPeriodSettings.patch({});
            const pp = GroupCategory.patch({ id: getParentCategory().id });
            pp.categoryIds.addDelete(props.category.id);
            settings.categories.addPatch(pp);

            await save([OrganizationRegistrationPeriod.patch({ id: props.period.id, settings })], [props.period]);

            showSuccessToast($t('%1XK', {
                categoryName: props.category.getName(props.period),
            }));
        }

        function createMergeContextMenuItem(category: GroupCategory): ContextMenuItem {
            const name = category.getName(props.period);

            return new ContextMenuItem({
                icon: 'unbox',
                name,
                disabled: mergeDisabledWith(category),
                destructive: true,
                action: async () => {
                    await mergeWith(category, name);
                    return true;
                },
            });
        }

        async function showMenu(event: MouseEvent) {
            const parentCategory = getParentCategory();
            const grandParentCategory = getGrandParentCategory();
            const subCategories = getSubCategories();

            const sections: ContextMenuItem[][] = [
                [
                    new ContextMenuItem({
                        icon: 'settings',
                        name: $t('%1cI'),
                        action: async () => {
                            await editCategory();
                            return true;
                        },
                    }),
                ],
            ];

            const createActions: ContextMenuItem[] = [];
            if (props.category.groupIds.length === 0) {
                createActions.push(new ContextMenuItem({
                    icon: 'folder-add',
                    name: $t('%LN'),
                    action: async () => {
                        await createCategory();
                        return true;
                    },
                }));
            }
            if (props.category.categoryIds.length === 0) {
                createActions.push(new ContextMenuItem({
                    icon: 'add',
                    name: $t('%LD'),
                    action: async () => {
                        await createGroup();
                        return true;
                    },
                }));
            }
            if (createActions.length > 0) {
                sections.push(createActions);
            }

            sections.push([
                new ContextMenuItem({
                    name: $t('%11f'),
                    icon: 'arrow-up',
                    action: async () => {
                        await move(-1);
                        return true;
                    },
                }),
                new ContextMenuItem({
                    name: $t('%11g'),
                    icon: 'arrow-down',
                    action: async () => {
                        await move(1);
                        return true;
                    },
                }),
            ]);

            sections.push([
                new ContextMenuItem({
                    icon: 'folder',
                    name: $t('%122'),
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                icon: 'folder',
                                name: $t('%1cr'),
                                description: grandParentCategory?.getName(props.period),
                                disabled: !grandParentCategory,
                                action: async () => {
                                    await moveTo(grandParentCategory!);
                                    return true;
                                },
                            }),
                        ],
                        subCategories.map(cat =>
                            new ContextMenuItem({
                                icon: 'folder',
                                name: cat.getName(props.period),
                                disabled: cat.groupIds.length > 0,
                                action: async () => {
                                    await moveTo(cat);
                                    return true;
                                },
                            }),
                        ),
                    ]),
                }),
                new ContextMenuItem({
                    icon: 'unbox',
                    name: $t('%1dQ'),
                    destructive: true,
                    disabled: !canDeleteOrRename || (props.category.groupIds.length === 0 && props.category.categoryIds.length === 0),
                    childMenu: new ContextMenu([
                        [
                            createMergeContextMenuItem(parentCategory),
                        ],
                        subCategories.map(cat => createMergeContextMenuItem(cat)),
                    ]),
                }),
                new ContextMenuItem({
                    name: $t('%CJ'),
                    destructive: true,
                    icon: 'trash',
                    disabled: !canDeleteOrRename,
                    action: async () => {
                        await deleteMe();
                        return true;
                    },
                }),
            ]);

            const menu = new ContextMenu(sections);

            if (event.type === 'contextmenu') {
                // show at mouse
                return await menu.show({
                    clickEvent: event,
                });
            }

            // show below button
            await menu.show({
                button: event.currentTarget as HTMLElement,
            });
        }

        return { showMenu, editCategory };
    };
}
