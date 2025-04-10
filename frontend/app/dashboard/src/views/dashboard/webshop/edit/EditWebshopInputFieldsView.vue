<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>{{ $t("Je kan zelf nog open vragen stellen (bv. 'naam lid') op bestelniveau (je kan dat ook doen per artikel, maar daarvoor moet je het artikel bewerken). Kies dus verstandig of je het bij een artikel ofwel op bestelniveau toevoegt! Op bestelniveau wordt het maar één keer gevraagd voor de volledige bestelling.") }}</p>

        <p class="warning-box">
            {{ $t('Deze functie is verouderd. Als je alle vrije invoervelden wist, en daarna opslaat, kan je gebruik maken van uitgebreidere vragenlijsten.') }}
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
