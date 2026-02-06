<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>{{ $t("25e9cef3-fd10-41bf-abf0-90bbcd6f5fd4") }}</p>

        <p class="warning-box">
            {{ $t('bd76a4c0-1c0c-4ba7-b3be-a1cd059f3640') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />
        <WebshopFieldsBox :fields="fields" @patch="addFieldsPatch" />
    </SaveView>
</template>

<script lang="ts" setup>
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SaveView, STErrorsDefault } from '@stamhoofd/components';
import { PrivateWebshop, WebshopField, WebshopMetaData } from '@stamhoofd/structures';

import { computed } from 'vue';
import WebshopFieldsBox from './fields/WebshopFieldsBox.vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';

const viewTitle = 'Vrije invoervelden';

const props = defineProps<UseEditWebshopProps>();

const { webshop, addPatch, errors, saving, save, hasChanges, shouldNavigateAway } = useEditWebshop({
    getProps: () => props,
});

const fields = computed(() => webshop.value.meta.customFields);

function addFieldsPatch(patch: PatchableArrayAutoEncoder<WebshopField>) {
    addPatch(PrivateWebshop.patch({
        meta: WebshopMetaData.patch({
            customFields: patch,
        }),
    }));
}

defineExpose({
    shouldNavigateAway,
});
</script>
