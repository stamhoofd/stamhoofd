<template>
    <STListItem v-long-press="(e: any) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editGroup()" @contextmenu.prevent="showContextMenu">
        <template #left>
            <GroupAvatar :group="group" />
        </template>

        <h2 class="style-title-list">
            {{ group.settings.name }}
        </h2>
        <template #right>
            <button type="button" class="button icon more gray hide-smartphone" @click.stop.prevent="showContextMenu" @contextmenu.stop />
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { ContextMenu, ContextMenuItem, EditGroupView, GroupAvatar, STListItem } from '@stamhoofd/components';
import { Group, GroupCategory, Organization, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings, TranslatedString } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { computed } from 'vue';

const props = defineProps<{
    group: Group;
    organization: Organization;
    period: OrganizationRegistrationPeriod;
    periods: OrganizationRegistrationPeriod[];
}>();

const emit = defineEmits<{
    (e: 'patch:period', value: AutoEncoderPatchType<OrganizationRegistrationPeriod>): void;
    (e: 'patch:otherPeriod', value: AutoEncoderPatchType<OrganizationRegistrationPeriod>): void;
}>();

const present = usePresent();

const otherPeriods = computed(() => props.periods.filter(p => p.id !== props.period.id));

function editGroup() {
    present(new ComponentWithProperties(EditGroupView, {
        period: props.period,
        groupId: props.group.id,
        isNew: false,
        saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
            emit('patch:period', patch);

            // Check deleted
            if (patch.groups.getDeletes().includes(props.group.id)) {
                const settings = OrganizationRegistrationPeriodSettings.patch({});
                const pp = GroupCategory.patch({ id: parentCategory.value.id });
                pp.groupIds.addDelete(props.group.id);
                settings.categories.addPatch(pp);
                const q = OrganizationRegistrationPeriod.patch({
                    settings,
                });
                emit('patch:period', q);
            }
        },
    }).setDisplayStyle('popup')).catch(console.error);
}

const parentCategory = computed(() => props.group.getParentCategories(props.period.settings.categories)[0]);
const subGroups = computed(() => parentCategory.value.groupIds.map(id => props.period.groups.find(g => g.id === id)!).filter(g => !!g));
const allCategories = computed(() => props.period.availableCategories.filter(c => c.categories.length === 0 && c.id !== parentCategory.value?.id));

function moveTo(category: GroupCategory) {
    const p = GroupCategory.patch({ id: category.id });
    p.groupIds.addPut(props.group.id);

    const settings = OrganizationRegistrationPeriodSettings.patch({});
    settings.categories.addPatch(p);

    const pp = GroupCategory.patch({ id: parentCategory.value.id });
    pp.groupIds.addDelete(props.group.id);
    settings.categories.addPatch(pp);

    const q = OrganizationRegistrationPeriod.patch({
        settings,
    });

    emit('patch:period', q);
};

function moveToOtherPeriod(period: OrganizationRegistrationPeriod, category: GroupCategory) {
    const groupPatch = Group.patch({ id: props.group.id, periodId: period.period.id });

    const settings = OrganizationRegistrationPeriodSettings.patch({});
    const categoryPatch1 = GroupCategory.patch({ id: parentCategory.value.id });
    categoryPatch1.groupIds.addDelete(props.group.id);
    settings.categories.addPatch(categoryPatch1);

    const periodPatch = OrganizationRegistrationPeriod.patch({
        settings,
    });

    const categoryPatch2 = GroupCategory.patch({ id: category.id });
    categoryPatch2.groupIds.addPut(props.group.id);

    const otherSettings = OrganizationRegistrationPeriodSettings.patch({});
    otherSettings.categories.addPatch(categoryPatch2);

    const otherPeriodPatch = OrganizationRegistrationPeriod.patch({
        id: period.id,
        settings: otherSettings,
    });

    otherPeriodPatch.groups.addPatch(groupPatch);

    emit('patch:otherPeriod', otherPeriodPatch);
    emit('patch:period', periodPatch);
};

function duplicate() {
    const duplicated = props.group.clone();
    duplicated.id = uuidv4();

    // Remove suffix
    duplicated.settings.name = TranslatedString.create(duplicated.settings.name.replace(/ \(kopie( \d+)?\)$/, ''));

    const suffix = ' (kopie)';

    // Count the groups that already have a suffix, and add the numuber inside the suffix
    // use subGroups.value
    const suffixes = subGroups.value.map(g => g.settings.name.startsWith(duplicated.settings.name + ' (kopie') && g.settings.name.match(/ \(kopie( \d+)?\)$/));
    const suffixesWithNumber = suffixes.filter(s => !!s) as RegExpMatchArray[];

    const maxNumber = suffixesWithNumber.length > 0 ? Math.max(...suffixesWithNumber.map(s => parseInt(s[1] ?? '1'))) : 0;

    if (maxNumber > 0) {
        duplicated.settings.name = TranslatedString.create(duplicated.settings.name + ' (kopie ' + (maxNumber + 1) + ')');
    }
    else {
        duplicated.settings.name = TranslatedString.create(duplicated.settings.name + suffix);
    }

    const p = GroupCategory.patch({ id: parentCategory.value.id });
    p.groupIds.addPut(duplicated.id, props.group.id);

    const settings = OrganizationRegistrationPeriodSettings.patch({});
    settings.categories.addPatch(p);

    const organizationPatch = OrganizationRegistrationPeriod.patch({
        settings,
    });

    organizationPatch.groups.addPut(duplicated);
    emit('patch:period', organizationPatch);
};

function showContextMenu(event: MouseEvent) {
    const moveToPeriodOptions = otherPeriods.value.map((p) => {
        if (p.period.locked) {
            return new ContextMenuItem({
                name: p.period.name,
                disabled: true,
            });
        }
        const menuItems = p.availableCategories.filter(c => c.categories.length === 0).map(c => new ContextMenuItem({
            name: c.settings.name,
            rightText: c.groupIds.length + '',

            action: () => {
                moveToOtherPeriod(p, c);
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
                name: 'Verplaats naar',
                childMenu: new ContextMenu([

                    allCategories.value.map(cat =>
                        new ContextMenuItem({
                            name: cat.settings.name,
                            rightText: cat.groupIds.length + '',
                            action: () => {
                                moveTo(cat);
                                return true;
                            },
                        }),
                    ),
                    [
                        new ContextMenuItem({
                            name: $t('Ander werkjaar'),
                            childMenu: new ContextMenu([
                                moveToPeriodOptions,

                            ]),
                            disabled: moveToPeriodOptions.filter(p => !p.disabled).length === 0,
                        }),
                    ],
                ]),
            }),

            new ContextMenuItem({
                name: 'Dupliceren',
                icon: 'copy',
                action: () => {
                    duplicate();
                    return true;
                },
            }),

            new ContextMenuItem({
                name: 'Verwijderen',
                icon: 'trash',
                action: () => {
                    const settings = OrganizationRegistrationPeriodSettings.patch({});
                    const pp = GroupCategory.patch({ id: parentCategory.value.id });
                    pp.groupIds.addDelete(props.group.id);
                    settings.categories.addPatch(pp);

                    const q = OrganizationRegistrationPeriod.patch({
                        settings,
                    });
                    q.groups.addDelete(props.group.id);

                    emit('patch:period', q);

                    return true;
                },
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-row-image {
    width: 50px;
    height: 50px;
    margin: -5px 0;
    border-radius: $border-radius;
}
</style>
