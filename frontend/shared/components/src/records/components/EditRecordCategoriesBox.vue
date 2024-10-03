<template>
    <div>
        <STList v-model="draggableCategories" :draggable="true">
            <template #item="{item: category}">
                <RecordCategoryRow :category="category" :categories="categories" :selectable="true" :settings="settings" @patch:categories="addArrayPatch" @edit="editCategory" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addCategory">
                <span class="icon add" />
                <span>Nieuwe vragenlijst</span>
            </button>
        </p>
    </div>
</template>

<script setup lang="ts">
import { RecordCategory } from '@stamhoofd/structures';
import { useDraggableArray, useEmitPatchArray } from '../../hooks';
import RecordCategoryRow from './RecordCategoryRow.vue';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { EditRecordCategoryView, RecordEditorSettings } from '..';
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';

const props = withDefaults(
    defineProps<{
        categories: RecordCategory[];
        settings: RecordEditorSettings<any>;
        allowChildCategories?: boolean;
    }>(),
    {
        allowChildCategories: true,
    },
);
const emit = defineEmits(['patch:categories']);
const present = usePresent();

const { addArrayPatch } = useEmitPatchArray<typeof props, 'categories', RecordCategory>(props, emit, 'categories');

const draggableCategories = useDraggableArray(() => props.categories, addArrayPatch);

async function editCategory(category: RecordCategory) {
    await present({
        components: [
            new ComponentWithProperties(EditRecordCategoryView, {
                categoryId: category.id,
                rootCategories: props.categories,
                settings: props.settings,
                isNew: false,
                allowChildCategories: props.allowChildCategories,
                saveHandler: async (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                    addArrayPatch(patch);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function addCategory() {
    const category = RecordCategory.create({});
    const arr = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    arr.addPut(category);

    await present({
        components: [
            new ComponentWithProperties(EditRecordCategoryView, {
                categoryId: category.id,
                rootCategories: [...props.categories, category],
                settings: props.settings,
                isNew: true,
                allowChildCategories: props.allowChildCategories,
                saveHandler: async (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                    addArrayPatch(arr.patch(patch));
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
