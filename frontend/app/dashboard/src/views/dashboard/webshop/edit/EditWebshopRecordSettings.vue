<template>
    <SaveView :loading="saving" :disabled="!hasChanges" @save="save" :title="$t(`Vragenlijsten en gegevens`)">
        <h1>
            {{ $t('26f3d0e6-eeaf-447e-b537-dcf94bd5591c') }}
        </h1>
        <p>{{ $t('e216423a-c008-4e69-8777-df282cf3f35b') }}</p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <hr><h2>{{ $t('d6512eda-1913-4f71-9cdb-e8dc7e35f375') }}</h2>

        <p>{{ $t('fd68e1a7-6059-47fc-b7ad-fdfe4924a67d') }}</p>

        <STList>
            <STListItem element-name="label" :selectable="true">
                <template #left>
                    <Checkbox v-model="phoneEnabled"/>
                </template>
                <p class="style-title-list">
                    {{ $t('90d84282-3274-4d85-81cd-b2ae95429c34') }}
                </p>
            </STListItem>
        </STList>

        <hr><h2>{{ $t('ec2b109d-27eb-40a2-b024-94e276f70665') }}</h2>

        <p>
            {{ $t('8e4a04e9-811d-4229-979c-4324f4dc5fca') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('34099e11-aafe-435c-bd11-5b681610008e') }}</a>
        </p>

        <STList v-model="categories" :draggable="true">
            <template #item="{item: category}">
                <RecordCategoryRow :category="category" :categories="categories" :selectable="true" :settings="editorSettings" @patch:categories="addCategoriesPatch" @edit="editCategory"/>
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addCategory">
                <span class="icon add"/>
                <span>{{ $t('80fe32ab-10a5-49de-b71b-522b248385f8') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { Checkbox, EditRecordCategoryView, RecordCategoryRow, RecordEditorSettings, RecordEditorType, STErrorsDefault, STList, STListItem, SaveView, checkoutUIFilterBuilders } from '@stamhoofd/components';
import { Checkout, PatchAnswers, PrivateWebshop, RecordCategory, WebshopMetaData } from '@stamhoofd/structures';
import { computed } from 'vue';
import { UseEditWebshopProps, useEditWebshop } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

const { webshop, addPatch, errors, saving, save, hasChanges } = useEditWebshop({
    getProps: () => props,
});

const present = usePresent();

const categories = computed({
    get: () => webshop.value.meta.recordCategories,
    set: (recordCategories: RecordCategory[]) => {
        addPatch(PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                recordCategories: recordCategories as any,
            }),
        }));
    } });

const phoneEnabled = computed({
    get: () => webshop.value.meta.phoneEnabled,
    set: (phoneEnabled: boolean) => {
        addPatch(PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                phoneEnabled,
            }),
        }));
    },
});

const editorSettings = computed(() => {
    return new RecordEditorSettings({
        type: RecordEditorType.Webshop,
        dataPermission: false,
        filterBuilder: (_categories: RecordCategory[]) => {
            return checkoutUIFilterBuilders[0];
        },
        exampleValue: Checkout.create({})
    });
});

function addCategory() {
    const category = RecordCategory.create({});
    const arr = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    arr.addPut(category);

    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(EditRecordCategoryView, {
                    categoryId: category.id,
                    rootCategories: [...categories.value, category],
                    settings: editorSettings.value,
                    isNew: true,
                    allowChildCategories: true,
                    saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                        addCategoriesPatch(arr.patch(patch));
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function editCategory(category: RecordCategory) {
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(EditRecordCategoryView, {
                    categoryId: category.id,
                    rootCategories: categories.value,
                    settings: editorSettings.value,
                    isNew: false,
                    allowChildCategories: true,
                    saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                        addCategoriesPatch(patch);
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function addCategoriesPatch(patch: PatchableArrayAutoEncoder<RecordCategory>) {
    addPatch(PrivateWebshop.patch({
        meta: WebshopMetaData.patch({
            recordCategories: patch,
        }),
    }));
}
</script>
