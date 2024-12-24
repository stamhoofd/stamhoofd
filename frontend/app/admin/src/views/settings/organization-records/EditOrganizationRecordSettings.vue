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
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { EditRecordCategoryView, RecordCategoryRow, RecordEditorSettings, useDraggableArray, useEmitPatchArray } from '@stamhoofd/components';
import { RecordCategory } from '@stamhoofd/structures';

const props
    = defineProps<{
        categories: RecordCategory[];
        settings: RecordEditorSettings<any>;
    }>();
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
                saveHandler: async (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                    addArrayPatch(arr.patch(patch));
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
