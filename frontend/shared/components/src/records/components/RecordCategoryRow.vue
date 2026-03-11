<template>
    <STListItem v-long-press="(e: MouseEvent) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editCategory()" @contextmenu.prevent="showContextMenu">
        <template v-if="settings.toggleDefaultEnabled" #left>
            <Checkbox :model-value="category.defaultEnabled" :disabled="true" />
        </template>

        <h3 class="style-title-list">
            {{ category.name || $t('%CL') }}
        </h3>
        <p v-if="filterDescription" class="style-description-small">
            {{ filterDescription }}
        </p>
        <p v-if="!category.childCategories.length && !category.records.length" class="style-description-small">
            {{ $t('%Rs') }}
        </p>
        <p v-else class="style-description-small">
            <template v-if="category.records.length">
                {{ category.records.length }} {{ category.records.length === 1 ? $t("%15F") : $t("%15G") }}
            </template>
            <span v-if="category.childCategories.length && category.records.length" v-text="' ' + $t('%M1') + ' '" />
            <template v-if="category.childCategories.length">
                {{ category.childCategories.length }} {{ category.childCategories.length === 1 ? $t("%n2") : $t("%15H") }}
            </template>
        </p>

        <template #right>
            <span v-if="category.containsSensitiveData" class="icon privacy gray" :v-tooltip="$t('%jJ')" />
            <span v-if="category.externalPermissionLevel === PermissionLevel.None" v-tooltip="$t('%170')" class="button icon eye-off gray" />
            <span v-if="category.externalPermissionLevel === PermissionLevel.Read" v-tooltip="$t('%171')" class="button icon no-edit gray" />

            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PermissionLevel, RecordCategory } from '@stamhoofd/structures';
import { computed } from 'vue';
import { propertyFilterToString } from '../../filters/UIFilter';
import { useEmitPatchArray, usePatchMoveUpDownSingle } from '../../hooks';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import { RecordEditorSettings } from '../RecordEditorSettings';

const props = withDefaults(
    defineProps<{
        category: RecordCategory;
        parentCategory?: RecordCategory | null;
        categories: RecordCategory[];
        settings: RecordEditorSettings<any>;
    }>(),
    {
        parentCategory: null,
    },
);
const emit = defineEmits<{
    'patch:categories': [patch: PatchableArrayAutoEncoder<RecordCategory>];
    'edit': [category: RecordCategory];
    'add': [category: RecordCategory | undefined];
}>();

const filterDescription = computed(() => props.category.filter ? propertyFilterToString(props.category.filter, filterBuilderForCategory()) : '');
const { addArrayPatch } = useEmitPatchArray<typeof props, 'categories', RecordCategory>(props, emit, 'categories' as const);
const { up, down } = usePatchMoveUpDownSingle(props.category.id, props.categories, addArrayPatch);

function showContextMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`%8k`),
                icon: 'settings',
                action: () => editCategory(),
            }),
            new ContextMenuItem({
                name: $t(`%10n`),
                icon: 'copy',
                action: () => addCategory(props.category.duplicate()),
            }),
            new ContextMenuItem({
                name: $t(`%11e`),
                icon: 'trash',
                action: () => deleteCategory(),
            }),
        ],
        [
            new ContextMenuItem({
                name: $t(`%11f`),
                icon: 'arrow-up',
                action: () => {
                    up();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`%11g`),
                icon: 'arrow-down',
                action: () => {
                    down();
                    return true;
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: $t(`%10q`),
                disabled: props.category.childCategories.length !== 0,
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: $t(`%10r`),
                            disabled: true,
                        }),
                    ],
                    [
                        ...props.categories.map(c => new ContextMenuItem({
                            name: c.name.toString(),
                            disabled: c.id === props.category.id,
                            action: async () => {
                                // Transform into a root category
                                if (!await CenteredMessage.confirm($t(`%11h`), $t(`%10t`), $t(`%11i`) + c.name + ').')) {
                                    return;
                                }

                                const childCategoryPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
                                childCategoryPatch.addPut(props.category);

                                const rootPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
                                rootPatch.addDelete(props.category.id);
                                rootPatch.addPatch(RecordCategory.patch({
                                    id: c.id,
                                    childCategories: childCategoryPatch,
                                }));

                                emit('patch:categories', rootPatch);
                            },
                        })),
                    ],
                ]),
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}

async function deleteCategory() {
    if (!await CenteredMessage.confirm($t(`%10w`), $t(`%CJ`), $t(`%11j`))) {
        return;
    }

    // Note we create a patch, but don't use it internally because that would throw errors. The view itszelf is not aware of the delete
    const arr = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    arr.addDelete(props.category.id);
    emit('patch:categories', arr);
}

function editCategory() {
    emit('edit', props.category);
}

async function addCategory(base?: RecordCategory) {
    emit('add', base);
}

function filterBuilderForCategory() {
    const rootIndex = props.categories.findIndex(c => c.id === props.category.id);
    if (rootIndex === -1) {
        return props.settings.filterBuilder([]);
    }
    const rootCategories = props.categories.slice(0, rootIndex + 1);
    return props.settings.filterBuilder(rootCategories);
}
</script>
