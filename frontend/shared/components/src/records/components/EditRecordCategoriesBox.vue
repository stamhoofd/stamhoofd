<template>
    <div>
        <STList v-model="draggableCategories" :draggable="true">
            <template #item="{item: category}">
                <RecordCategoryRow :category="category" :categories="categories" :selectable="true" :settings="settings" @patch:categories="addArrayPatch" @edit="editCategory" @add="addCategory($event)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addCategory()">
                <span class="icon add" />
                <span>{{ $t('%10l') }}</span>
            </button>
        </p>
    </div>
</template>

<script setup lang="ts">
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { RecordCategory } from '@stamhoofd/structures';
import type { RecordEditorSettings } from '#records/RecordEditorSettings.ts';

import { useDraggableArray } from '#hooks/useDraggableArray.ts';
import { useEmitPatchArray } from '#hooks/useEmitPatchArray.ts';
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

// ids of records that already had been saved in the database
const savedRecordIds = new Set(props.categories.flatMap(c => c.getAllRecords().map(r => r.id)));

async function editCategory(category: RecordCategory) {
    await present({
        components: [
            AsyncComponent(() => import('#records/EditRecordCategoryView.vue'), {
                categoryId: category.id,
                rootCategories: props.categories,
                settings: props.settings,
                isNew: false,
                allowChildCategories: props.allowChildCategories,
                savedRecordIds,
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
            AsyncComponent(() => import('#records/EditRecordCategoryView.vue'), {
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
