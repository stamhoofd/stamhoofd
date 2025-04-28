<template>
    <STListItem v-long-press="(e: MouseEvent) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editCategory()" @contextmenu.prevent="showContextMenu">
        <template v-if="settings.toggleDefaultEnabled" #left>
            <Checkbox :model-value="category.defaultEnabled" :disabled="true" />
        </template>

        <h3 class="style-title-list">
            {{ category.name || $t('54685a94-1ae2-46f9-aa4b-03f0b3939fd3') }}
        </h3>
        <p v-if="filterDescription" class="style-description-small">
            {{ filterDescription }}
        </p>
        <p v-if="!category.childCategories.length && !category.records.length" class="style-description-small">
            {{ $t('3e8d9718-569f-4243-b9ba-ae8f3df6d598') }}
        </p>
        <p v-else class="style-description-small">
            <template v-if="category.records.length">
                {{ category.records.length }} {{ category.records.length === 1 ? $t("vraag") : $t("vragen") }}
            </template>
            <span v-if="category.childCategories.length && category.records.length" v-text="' ' + $t('6a156458-b396-4d0f-b562-adb3e38fc51b') + ' '" />
            <template v-if="category.childCategories.length">
                {{ category.childCategories.length }} {{ category.childCategories.length === 1 ? $t("categorie") : $t("categorieën") }}
            </template>
        </p>

        <template #right>
            <span v-if="category.containsSensitiveData" class="icon privacy gray" :v-tooltip="$t('007c7ed0-9cac-4697-8ad7-d18684608013')" />

            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { RecordCategory } from '@stamhoofd/structures';
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
                name: $t(`df8def26-260a-431b-a7fe-09fac12f97e0`),
                icon: 'settings',
                action: () => editCategory(),
            }),
            new ContextMenuItem({
                name: $t(`d4ac382c-5394-4451-a25b-3b97f6d60168`),
                icon: 'copy',
                action: () => addCategory(props.category.duplicate()),
            }),
            new ContextMenuItem({
                name: $t(`4b50022e-7937-4b21-b97f-35af4430ed9a`),
                icon: 'trash',
                action: () => deleteCategory(),
            }),
        ],
        [
            new ContextMenuItem({
                name: $t(`fa96b3e2-08bc-4ce1-9562-e09eb26bcd5b`),
                icon: 'arrow-up',
                action: () => {
                    up();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`dd2032e6-7a34-4027-a678-dbda939782c1`),
                icon: 'arrow-down',
                action: () => {
                    down();
                    return true;
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: $t(`58351618-cc4a-4785-a8c7-dfd741aa9985`),
                disabled: props.category.childCategories.length !== 0,
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: $t(`ba261762-9151-487c-a3a1-deb1c59e2a14`),
                            disabled: true,
                        }),
                    ],
                    [
                        ...props.categories.map(c => new ContextMenuItem({
                            name: c.name.toString(),
                            disabled: c.id === props.category.id,
                            action: async () => {
                                // Transform into a root category
                                if (!await CenteredMessage.confirm($t(`e48fd329-0701-47d6-998e-7598691b0200`), $t(`9a384a73-d222-49f8-9203-76b8e525f1ab`), $t(`34760087-cbb3-416b-b4ef-212f15fc07a8`) + c.name + ').')) {
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
    if (!await CenteredMessage.confirm($t(`95557c11-2b92-4a70-8945-99f6c6f7051c`), $t(`faae9011-c50d-4ada-aed0-c1b578782b2a`), $t(`e955be72-7a4e-4a0d-9872-043cf75f1134`))) {
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
