<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`Vragenlijsten en gegevens`)" @save="save">
        <h1>
            {{ $t('da5f0578-ebf9-40e1-8caf-baa3a7970b28') }}
        </h1>
        <p>{{ $t('422c4fca-4c1d-44f4-8e08-b8044c869b7f') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <hr><h2>{{ $t('98d06da4-164b-4b8f-a373-3873fa99e1ab') }}</h2>

        <p>{{ $t('fd68e1a7-6059-47fc-b7ad-fdfe4924a67d') }}</p>

        <STList>
            <STListItem element-name="label" :selectable="true">
                <template #left>
                    <Checkbox v-model="phoneEnabled" />
                </template>
                <p class="style-title-list">
                    {{ $t('90d84282-3274-4d85-81cd-b2ae95429c34') }}
                </p>
            </STListItem>
        </STList>

        <hr><h2>{{ $t('ec8efff4-e2cf-4755-b8fb-a47f686be173') }}</h2>

        <p>
            {{ $t('86161523-8879-4092-a332-567bf55e0f52') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('a36700a3-64be-49eb-b1fd-60af7475eb4e') }}</a>
        </p>

        <STList v-model="categories" :draggable="true">
            <template #item="{item: category}">
                <RecordCategoryRow :category="category" :categories="categories" :selectable="true" :settings="editorSettings" @patch:categories="addCategoriesPatch" @edit="editCategory" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addCategory">
                <span class="icon add" />
                <span>{{ $t('9a390ab2-bb28-49dc-9837-b389f5877c53') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { Checkbox, EditRecordCategoryView, RecordCategoryRow, RecordEditorSettings, RecordEditorType, STErrorsDefault, STList, STListItem, SaveView, checkoutUIFilterBuilders } from '@stamhoofd/components';
import { Checkout, PrivateWebshop, RecordCategory, WebshopMetaData } from '@stamhoofd/structures';
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
        exampleValue: Checkout.create({}),
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
