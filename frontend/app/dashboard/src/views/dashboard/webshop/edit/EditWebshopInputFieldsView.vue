<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>{{ $t("191d16d0-80d0-4d88-8043-8f80119a56ac") }}</p>

        <p class="warning-box">
            {{ $t('0c1985aa-b220-4810-ad4e-df2a8a227ec6') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox"/>
        <WebshopFieldsBox :fields="fields" @patch="addFieldsPatch"/>
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

const { webshop, addPatch, errors, saving, save, hasChanges } = useEditWebshop({
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
</script>
