<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editCategory()" @contextmenu.prevent="showContextMenu">
        <template #left>
            <Checkbox :model-value="category.defaultEnabled" :disabled="true" />
        </template>
        
        <h3 class="style-title-list">
            {{ category.name || $t('shared.untitled') }}
        </h3>
        <p v-if="filterDescription" class="style-description-small">
            {{ filterDescription }}
        </p>
        <p v-if="!category.childCategories.length && !category.records.length" class="style-description-small">
            Leeg
        </p>
        <p v-else class="style-description-small">
            <template v-if="category.records.length">
                {{ category.records.length }} {{ category.records.length == 1 ? "vraag" : "vragen" }}
            </template>
            <template v-if="category.childCategories.length && category.records.length">
                en
            </template>
            <template v-if="category.childCategories.length">
                {{ category.childCategories.length }} {{ category.childCategories.length == 1 ? "categorie" : "categorieën" }}
            </template>
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { RecordCategory } from '@stamhoofd/structures';
import { computed } from 'vue';
import { propertyFilterToString } from '../../filters/UIFilter';
import { usePatchMoveUpDown } from '../../hooks';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import { RecordEditorSettings } from '../RecordEditorSettings';

const props = withDefaults(
    defineProps<{
        category: RecordCategory
        parentCategory?: RecordCategory | null
        categories: RecordCategory[]
        settings: RecordEditorSettings<any>
    }>(),
    {
        parentCategory: null
    }
);
const emit = defineEmits<{
    patch: [patch: PatchableArrayAutoEncoder<RecordCategory>],
    edit: [category: RecordCategory],
}>()

const filterDescription = computed(() => props.category.filter ? propertyFilterToString(props.category.filter, filterBuilderForCategory()) : '')
const {up, down} = usePatchMoveUpDown(props.category.id, props.categories, addPatch)

function addPatch(patch: PatchableArrayAutoEncoder<RecordCategory>) {
    emit('patch', patch)
}

function showContextMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: "Verplaats omhoog",
                icon: "arrow-up",
                action: () => {
                    up()
                    return true;
                }
            }),
            new ContextMenuItem({
                name: "Verplaats omlaag",
                icon: "arrow-down",
                action: () => {
                    down()
                    return true;
                }
            }),
        ]
    ])
    menu.show({ clickEvent: event }).catch(console.error)
}

function editCategory() {
    emit('edit', props.category)
}

function filterBuilderForCategory() {
    const rootIndex = props.categories.findIndex(c => c.id === props.category.id)
    if (rootIndex === -1) {
        return props.settings.filterBuilder([])
    }
    const rootCategories = props.categories.slice(0, rootIndex + 1)
    return props.settings.filterBuilder(rootCategories)
}
</script>
