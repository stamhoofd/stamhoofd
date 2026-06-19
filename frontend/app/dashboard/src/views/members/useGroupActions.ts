import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';

import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { useLoadRecentPeriods } from '@stamhoofd/networking/hooks/useLoadRecentPeriods';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriods';
import { Group, GroupCategory, GroupSettings, GroupStatus, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings, TranslatedString } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

/**
 * Actions for a single group (edit, move, move to another period, duplicate, delete).
 *
 * By default the changes are saved straight to the API. Pass a `saveHandler` to keep the
 * patch in memory instead (e.g. when collecting multiple changes before saving them in one go).
 */
export function useGroupActions(saveHandler?: (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => Promise<void> | void) {
    const present = usePresent();
    const patchOrganizationPeriods = usePatchOrganizationPeriods();
    const getPeriods = useLoadRecentPeriods();

    return function getFor(props: {
        group: Group;
        period: OrganizationRegistrationPeriod;
        /**
         * The periods the group can be moved to. Fetched automatically when not provided.
         */
        periods?: OrganizationRegistrationPeriod[];
    }) {
        function getParentCategory() {
            return props.group.getParentCategories(props.period.settings.categories)[0];
        }

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

        function removeFromParentCategoryPatch() {
            const settings = OrganizationRegistrationPeriodSettings.patch({});
            const pp = GroupCategory.patch({ id: getParentCategory().id });
            pp.groupIds.addDelete(props.group.id);
            settings.categories.addPatch(pp);

            return OrganizationRegistrationPeriod.patch({
                id: props.period.id,
                settings,
            });
        }

        async function editGroup() {
            await present(AsyncComponent(() => import('@stamhoofd/components/groups/EditGroupView.vue'), {
                period: props.period,
                groupId: props.group.id,
                isNew: false,
                // EditGroupView shows its own success toast, but only when we save to the API directly
                showToasts: !saveHandler,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    patch.id = props.period.id;
                    const patches = [patch];

                    // When the group is deleted from within the edit view, also remove it from its category
                    if (patch.groups.getDeletes().includes(props.group.id)) {
                        patches.push(removeFromParentCategoryPatch());
                    }

                    await save(patches, [props.period]);
                },
            }).setDisplayStyle('popup'));
        }

        // Reorder the group within its category (offset -1 = up, +1 = down)
        async function move(offset: -1 | 1) {
            const parentCategory = getParentCategory();
            const ids = parentCategory.groupIds;
            const index = ids.findIndex(id => id === props.group.id);
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
            reorder.addMove(props.group.id, ids[targetIndex] ?? null);

            const settings = OrganizationRegistrationPeriodSettings.patch({});
            settings.categories.addPatch(GroupCategory.patch({ id: parentCategory.id, groupIds: reorder }));

            await save([OrganizationRegistrationPeriod.patch({ id: props.period.id, settings })], [props.period]);
        }

        async function moveTo(category: GroupCategory, period: OrganizationRegistrationPeriod) {
            // Only confirm when saving directly to the API, otherwise the change is collected in memory
            if (!saveHandler && !await CenteredMessage.confirm({
                title: $t('Ben je zeker dat je de groep ‘{groupName}’ wilt verplaatsen naar ‘{categoryName}’?', {
                    groupName: props.group.settings.name.toString(),
                    categoryName: category.getName(period),
                }),
                confirmText: $t('Ja, verplaatsen'),
            })) {
                return;
            }

            const p = GroupCategory.patch({ id: category.id });
            p.groupIds.addPut(props.group.id);

            const settings = OrganizationRegistrationPeriodSettings.patch({});
            settings.categories.addPatch(p);

            const pp = GroupCategory.patch({ id: getParentCategory().id });
            pp.groupIds.addDelete(props.group.id);
            settings.categories.addPatch(pp);

            await save([
                OrganizationRegistrationPeriod.patch({
                    id: props.period.id,
                    settings,
                }),
            ], [props.period]);

            showSuccessToast($t('‘{groupName}’ is verplaatst naar ‘{categoryName}’', {
                groupName: props.group.settings.name.toString(),
                categoryName: category.getName(period),
            }));
        }

        async function moveToOtherPeriod(otherPeriod: OrganizationRegistrationPeriod, category: GroupCategory) {
            if (props.group.settings.hasBundleDiscounts) {
                Toast.error($t('Je kan geen groep met bundelkortingen verplaatsen naar een ander werkjaar. Verwijder de bundelkortingen eerst.')).show();
                return;
            }

            // Only confirm when saving directly to the API, otherwise the change is collected in memory
            if (!saveHandler && !await CenteredMessage.confirm({
                title: $t('Ben je zeker dat je de groep ‘{groupName}’ wilt verplaatsen naar ‘{categoryName}’ in {periodName}?', {
                    groupName: props.group.settings.name.toString(),
                    categoryName: category.getName(otherPeriod),
                    periodName: otherPeriod.period.name,
                }),
                confirmText: $t('Ja, verplaatsen'),
            })) {
                return;
            }

            const groupPatch = Group.patch({ id: props.group.id, periodId: otherPeriod.period.id });

            // Remove the group from its category in the current period
            const settings = OrganizationRegistrationPeriodSettings.patch({});
            const categoryPatch1 = GroupCategory.patch({ id: getParentCategory().id });
            categoryPatch1.groupIds.addDelete(props.group.id);
            settings.categories.addPatch(categoryPatch1);

            const periodPatch = OrganizationRegistrationPeriod.patch({
                id: props.period.id,
                settings,
            });

            // Add the group to a category in the other period
            const categoryPatch2 = GroupCategory.patch({ id: category.id });
            categoryPatch2.groupIds.addPut(props.group.id);

            const otherSettings = OrganizationRegistrationPeriodSettings.patch({});
            otherSettings.categories.addPatch(categoryPatch2);

            const otherPeriodPatch = OrganizationRegistrationPeriod.patch({
                id: otherPeriod.id,
                settings: otherSettings,
            });
            otherPeriodPatch.groups.addPatch(groupPatch);

            try {
                // order is important here
                await save([otherPeriodPatch, periodPatch], [props.period, otherPeriod]);
            } catch (e) {
                console.error(e);
                Toast.fromError(e).show();
                return;
            }

            showSuccessToast($t('‘{groupName}’ is verplaatst naar ‘{categoryName}’ in {periodName}', {
                groupName: props.group.settings.name.toString(),
                categoryName: category.getName(otherPeriod),
                periodName: otherPeriod.period.name,
            }));
        }

        async function duplicate() {
            const parentCategory = getParentCategory();
            const subGroups = parentCategory.groupIds.map(id => props.period.groups.find(g => g.id === id)!).filter(g => !!g);

            const duplicated = props.group.clone();
            duplicated.id = uuidv4();

            // Remove suffix
            duplicated.settings.name = TranslatedString.create(duplicated.settings.name.replace(/ \(kopie( \d+)?\)$/, ''));

            const suffix = ' (kopie)';

            // Count the groups that already have a suffix, and add the number inside the suffix
            const suffixes = subGroups.map(g => g.settings.name.startsWith(duplicated.settings.name + ' (kopie') && g.settings.name.match(/ \(kopie( \d+)?\)$/));
            const suffixesWithNumber = suffixes.filter(s => !!s) as RegExpMatchArray[];

            const maxNumber = suffixesWithNumber.length > 0 ? Math.max(...suffixesWithNumber.map(s => parseInt(s[1] ?? '1'))) : 0;

            if (maxNumber > 0) {
                duplicated.settings.name = TranslatedString.create(duplicated.settings.name + ' (kopie ' + (maxNumber + 1) + ')');
            } else {
                duplicated.settings.name = TranslatedString.create(duplicated.settings.name + suffix);
            }

            const p = GroupCategory.patch({ id: parentCategory.id });
            p.groupIds.addPut(duplicated.id, props.group.id);

            const settings = OrganizationRegistrationPeriodSettings.patch({});
            settings.categories.addPatch(p);

            const periodPatch = OrganizationRegistrationPeriod.patch({
                id: props.period.id,
                settings,
            });
            periodPatch.groups.addPut(duplicated);

            await save([periodPatch], [props.period]);

            showSuccessToast($t('‘{groupName}’ is gedupliceerd', {
                groupName: props.group.settings.name.toString(),
            }));
        }

        /**
         * Deletes the group. Returns whether the group was actually deleted (false when cancelled).
         */
        async function deleteGroup(): Promise<boolean> {
            // Only confirm when saving directly to the API, otherwise the change is collected in memory
            if (!saveHandler && !await CenteredMessage.confirm({
                title: $t('Ben je zeker dat je de groep ‘{groupName}’ en bijhorende gegevens wilt verwijderen?', { groupName: props.group.settings.name.toString() }),
                confirmText: $t('Ja, verwijderen'),
                destructive: true,
                requireCheckbox: $t('Alle inschrijvingen mee verwijderen'),
                availabilityDelay: 1_000,
            })) {
                return false;
            }

            const settings = OrganizationRegistrationPeriodSettings.patch({});
            // Remove the group from every category that references it
            for (const category of props.period.settings.categories) {
                if (category.groupIds.includes(props.group.id)) {
                    const pp = GroupCategory.patch({ id: category.id });
                    pp.groupIds.addDelete(props.group.id);
                    settings.categories.addPatch(pp);
                }
            }

            const periodPatch = OrganizationRegistrationPeriod.patch({
                id: props.period.id,
                settings,
            });
            periodPatch.groups.addDelete(props.group.id);

            await save([periodPatch], [props.period]);

            showSuccessToast($t('‘{groupName}’ is verwijderd', {
                groupName: props.group.settings.name.toString(),
            }));

            return true;
        }

        /**
         * Opens the group's registrations. Returns whether the group was opened (false when cancelled).
         */
        async function openGroup(): Promise<boolean> {
            // Only confirm when saving directly to the API, otherwise the change is collected in memory
            if (!saveHandler && !await CenteredMessage.confirm({
                title: $t('Ben je zeker dat je de inschrijvingen wilt openen?'),
                confirmText: $t('Ja, openen'),
            })) {
                return false;
            }

            const groupPatch = Group.patch({
                id: props.group.id,
                status: GroupStatus.Open,
            });

            if (props.group.settings.registrationStartDate && props.group.settings.registrationStartDate.getTime() > Date.now()) {
                groupPatch.settings = GroupSettings.patch({
                    registrationStartDate: null,
                });
            }

            if (props.group.settings.registrationEndDate && props.group.settings.registrationEndDate.getTime() <= Date.now()) {
                groupPatch.settings = GroupSettings.patch({
                    registrationEndDate: null,
                });
            }

            const periodPatch = OrganizationRegistrationPeriod.patch({ id: props.period.id });
            periodPatch.groups.addPatch(groupPatch);

            await save([periodPatch], [props.period]);

            showSuccessToast($t('De inschrijvingen zijn terug open'));

            return true;
        }

        /**
         * Closes the group's registrations. Returns whether the group was closed (false when cancelled).
         */
        async function closeGroup(): Promise<boolean> {
            // Only confirm when saving directly to the API, otherwise the change is collected in memory
            if (!saveHandler && !await CenteredMessage.confirm({
                title: $t('Ben je zeker dat je de inschrijvingen wilt sluiten?'),
                confirmText: $t('Ja, sluiten'),
            })) {
                return false;
            }

            const periodPatch = OrganizationRegistrationPeriod.patch({ id: props.period.id });
            periodPatch.groups.addPatch(Group.patch({
                id: props.group.id,
                status: GroupStatus.Closed,
            }));

            await save([periodPatch], [props.period]);

            showSuccessToast($t('De inschrijvingen zijn gesloten'));

            return true;
        }

        async function showMenu(event: MouseEvent) {
            const parentCategory = getParentCategory();
            const allCategories = props.period.availableCategories.filter(c => c.categories.length === 0 && c.id !== parentCategory?.id);

            const periods = props.periods ?? await getPeriods(props.period);
            const otherPeriods = periods.filter(p => p.id !== props.period.id);

            const moveToPeriodOptions = otherPeriods.map((p) => {
                if (p.period.locked) {
                    return new ContextMenuItem({
                        name: p.period.name,
                        disabled: true,
                    });
                }
                const menuItems = p.availableCategories.filter(c => c.categories.length === 0).map(c => new ContextMenuItem({
                    name: c.getName(props.period),
                    rightText: c.groupIds.length + '',
                    action: () => {
                        moveToOtherPeriod(p, c).catch(console.error);
                        return true;
                    },
                }));

                return new ContextMenuItem({
                    name: p.period.name,
                    disabled: menuItems.length === 0,
                    childMenu: new ContextMenu([
                        menuItems,
                    ]),
                });
            });

            const menu = new ContextMenu([
                [
                    new ContextMenuItem({
                        name: $t('Bewerken'),
                        icon: 'edit',
                        action: () => {
                            editGroup().catch(console.error);
                            return true;
                        },
                    }),
                ],
                [
                    new ContextMenuItem({
                        name: $t('Verplaats omhoog'),
                        icon: 'arrow-up',
                        action: async () => {
                            await move(-1);
                            return true;
                        },
                    }),
                    new ContextMenuItem({
                        name: $t('Verplaats omlaag'),
                        icon: 'arrow-down',
                        action: async () => {
                            await move(1);
                            return true;
                        },
                    }),
                ],
                [
                    new ContextMenuItem({
                        icon: 'folder',
                        name: $t('Verplaats naar'),
                        childMenu: new ContextMenu([
                            allCategories.map(cat =>
                                new ContextMenuItem({
                                    name: cat.getName(props.period),
                                    rightText: cat.groupIds.length + '',
                                    action: async () => {
                                        await moveTo(cat, props.period);
                                        return true;
                                    },
                                }),
                            ),
                            [
                                new ContextMenuItem({
                                    name: $t('%1HU'),
                                    childMenu: new ContextMenu([
                                        moveToPeriodOptions,
                                    ]),
                                    disabled: moveToPeriodOptions.filter(p => !p.disabled).length === 0,
                                }),
                            ],
                        ]),
                    }),

                    new ContextMenuItem({
                        name: $t('Dupliceren'),
                        icon: 'copy',
                        action: async () => {
                            await duplicate();
                            return true;
                        },
                    }),

                    new ContextMenuItem({
                        name: props.group.closed ? $t('Inschrijvingen openen') : $t('Inschrijvingen afsluiten'),
                        icon: props.group.closed ? 'unlock' : 'lock',
                        destructive: !props.group.closed,
                        action: async () => {
                            if (props.group.closed) {
                                await openGroup();
                            } else {
                                await closeGroup();
                            }
                            return true;
                        },
                    }),

                    new ContextMenuItem({
                        name: $t('Verwijderen'),
                        destructive: true,
                        icon: 'trash',
                        action: async () => {
                            await deleteGroup();
                            return true;
                        },
                    }),
                ],
            ]);

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

        return { showMenu, editGroup, openGroup, closeGroup, deleteGroup };
    };
}
