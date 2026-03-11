<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`%u1`)" @save="save">
        <h1>
            {{ $t('%u1') }}
        </h1>
        <p>{{ $t('%Rk') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <hr>
        <h2>{{ $t('%Rl') }}</h2>

        <p>{{ $t('%48') }}</p>

        <STList>
            <STListItem element-name="label" :selectable="true">
                <template #left>
                    <Checkbox v-model="phoneEnabled" />
                </template>
                <p class="style-title-list">
                    {{ $t('%2k') }}
                </p>
            </STListItem>
        </STList>

        <hr>
        <h2>{{ $t('%Rm') }}</h2>

        <p>
            {{ $t('%Rn') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('%19t') }}</a>
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
