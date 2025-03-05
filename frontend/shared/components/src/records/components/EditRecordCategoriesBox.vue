<template>
    <div>
        <STList v-model="draggableCategories" :draggable="true">
            <template #item="{item: category}">
                <RecordCategoryRow :category="category" :categories="categories" :selectable="true" :settings="settings" @patch:categories="addArrayPatch" @edit="editCategory" @add="addCategory($event)"/>
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addCategory()">
                <span class="icon add"/>
                <span>{{ $t('80fe32ab-10a5-49de-b71b-522b248385f8') }}</span>
            </button>
        </p>
    </div>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { RecordCategory } from '@stamhoofd/structures';
import { EditRecordCategoryView, RecordEditorSettings } from '..';
import { useDraggableArray, useEmitPatchArray } from '../../hooks';
import RecordCategoryRow from './RecordCategoryRow.vue';

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

async function addCategory(base?: RecordCategory) {
    const category = base ?? RecordCategory.create({});
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
