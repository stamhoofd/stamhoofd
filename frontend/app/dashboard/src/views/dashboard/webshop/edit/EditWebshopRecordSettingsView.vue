<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`d0f49d2a-6b83-4e03-9480-4d0995bbb0a1`)" @save="save">
        <h1>
            {{ $t('da5f0578-ebf9-40e1-8caf-baa3a7970b28') }}
        </h1>
        <p>{{ $t('422c4fca-4c1d-44f4-8e08-b8044c869b7f') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <hr>
        <h2>{{ $t('98d06da4-164b-4b8f-a373-3873fa99e1ab') }}</h2>

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

        <hr>
        <h2>{{ $t('ec8efff4-e2cf-4755-b8fb-a47f686be173') }}</h2>

        <p>
            {{ $t('86161523-8879-4092-a332-567bf55e0f52') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('a36700a3-64be-49eb-b1fd-60af7475eb4e') }}</a>
        </p>

        <EditRecordCategoriesBox :categories="categories" :settings="editorSettings" @patch:categories="addCategoriesPatch" />
    </SaveView>
</template>

<script lang="ts" setup>
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Checkbox, EditRecordCategoriesBox, GroupUIFilterBuilder, RecordEditorSettings, RecordEditorType, STErrorsDefault, STList, STListItem, SaveView, useCheckoutInMemoryFilterBuilders } from '@stamhoofd/components';
import { Checkout, PrivateWebshop, RecordCategory, WebshopMetaData } from '@stamhoofd/structures';
import { computed } from 'vue';
import { UseEditWebshopProps, useEditWebshop } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

const { webshop, addPatch, errors, saving, save, hasChanges, shouldNavigateAway } = useEditWebshop({
    getProps: () => props,
});

const categories = computed(() => webshop.value.meta.recordCategories);
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

const getCheckoutFilterDefinitions = useCheckoutInMemoryFilterBuilders();

const editorSettings = computed(() => {
    return new RecordEditorSettings({
        type: RecordEditorType.Webshop,
        dataPermission: false,
        filterBuilder: (_categories: RecordCategory[]) => {
            if (!props.webshopManager?.webshop) {
                return new GroupUIFilterBuilder({
                    builders: [],
                });
            }
            return getCheckoutFilterDefinitions(props.webshopManager?.webshop)[0];
        },
        exampleValue: Checkout.create({}),
    });
});

function addCategoriesPatch(patch: PatchableArrayAutoEncoder<RecordCategory>) {
    addPatch(PrivateWebshop.patch({
        meta: WebshopMetaData.patch({
            recordCategories: patch,
        }),
    }));
}

defineExpose({
    shouldNavigateAway,
});
</script>
