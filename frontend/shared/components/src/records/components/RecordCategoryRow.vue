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
            {{ $t('Leeg') }}
        </p>
        <p v-else class="style-description-small">
            <template v-if="category.records.length">
                {{ category.records.length }} {{ category.records.length === 1 ? "vraag" : "vragen" }}
            </template>
            <template v-if="category.childCategories.length && category.records.length">
                {{ $t('en') }}
            </template>
            <template v-if="category.childCategories.length">
                {{ category.childCategories.length }} {{ category.childCategories.length === 1 ? "categorie" : "categorieën" }}
            </template>
        </p>

        <template #right>
            <span v-if="category.containsSensitiveData" class="icon privacy gray" :v-tooltip="$t('Vereist toestemming gegevensverzameling')" />

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
                name: 'Wijzig instellingen',
                icon: 'settings',
                action: () => editCategory(),
            }),
            new ContextMenuItem({
                name: 'Categorie dupliceren',
                icon: 'copy',
                action: () => addCategory(props.category.duplicate()),
            }),
            new ContextMenuItem({
                name: 'Categorie verwijderen',
                icon: 'trash',
                action: () => deleteCategory(),
            }),
        ],
        [
            new ContextMenuItem({
                name: 'Verplaats omhoog',
                icon: 'arrow-up',
                action: () => {
                    up();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: 'Verplaats omlaag',
                icon: 'arrow-down',
                action: () => {
                    down();
                    return true;
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: 'Verplaats naar vragenlijst',
                disabled: props.category.childCategories.length !== 0,
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: 'Hoofdvragenlijst',
                            disabled: true,
                        }),
                    ],
                    [
                        ...props.categories.map(c => new ContextMenuItem({
                            name: c.name,
                            disabled: c.id === props.category.id,
                            action: async () => {
                                // Transform into a root category
                                if (!await CenteredMessage.confirm('Ben je zeker dat je deze vragenlijst wilt verplaatsen?', 'Ja, verplaatsen', 'Deze vragenlijst zal worden verplaatst naar de gekozen vragenlijst (' + c.name + ').')) {
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
    if (!await CenteredMessage.confirm('Weet je zeker dat je deze vragenlijst wilt verwijderen?', 'Verwijderen', 'Nadat je hebt opgeslagen kan je dit niet meer ongedaan maken')) {
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
