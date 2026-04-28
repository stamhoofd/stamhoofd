<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`%u1`)" @save="save">
        <h1>
            {{ $t('%u1') }}
        </h1>
        <p>{{ $t('%Rk') }}</p>

        <p v-if="webshop.meta.isTicketBased" class="info-box">
            {{ $t(`%1OE`) }}
        </p>
        <p v-else-if="webshop.meta.isRegistrations" class="info-box">
            {{ $t(`%1Pi`) }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <hr>
        <h2>{{ $t('%Rl') }}</h2>

        <p>{{ $t('%48') }}</p>

        <STList>
            <STListItem element-name="label" :selectable="false">
                <template #left>
                    <Checkbox :checked="true" :disabled="true" />
                </template>
                <p class="style-title-list">
                    {{ $t('%1Os') }}
                </p>
                <p class="style-description-small">
                    {{ $t('%1Nj') }}
                </p>
            </STListItem>
            <STListItem element-name="label" :selectable="false">
                <template #left>
                    <Checkbox :checked="true" :disabled="true" />
                </template>
                <p class="style-title-list">
                    {{ $t('%1FK') }}
                </p>
                <p class="style-description-small">
                    {{ $t('%1PA') }}
                </p>
            </STListItem>
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
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useCheckoutInMemoryFilterBuilders } from '@stamhoofd/components/filters/filter-builders/checkout.ts';
import { GroupUIFilterBuilder } from '@stamhoofd/components/filters/GroupUIFilter.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import EditRecordCategoriesBox from '@stamhoofd/components/records/components/EditRecordCategoriesBox.vue';
import { RecordEditorSettings, RecordEditorType } from '@stamhoofd/components/records/RecordEditorSettings.ts';
import type { RecordCategory } from '@stamhoofd/structures';
import { Checkout, PrivateWebshop, WebshopMetaData } from '@stamhoofd/structures';
import { computed } from 'vue';
import type { UseEditWebshopProps } from './useEditWebshop';
import { useEditWebshop } from './useEditWebshop';

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
        filterBuilder: (categories: RecordCategory[]) => {
            if (!props.webshopManager?.webshop) {
                return new GroupUIFilterBuilder({
                    builders: [],
                });
            }
            return getCheckoutFilterDefinitions(webshop.value, categories)[0];
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
