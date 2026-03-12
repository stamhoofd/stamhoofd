<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>{{ $t("%Qv") }}</p>

        <p class="warning-box">
            {{ $t('%Qu') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />
        <WebshopFieldsBox :fields="fields" @patch="addFieldsPatch" />
    </SaveView>
</template>

<script lang="ts" setup>
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
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
