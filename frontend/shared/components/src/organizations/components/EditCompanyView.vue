<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges && !isNew" class="group-edit-view" :deleting="deleting" @save="save" v-on="!isNew && deleteHandler ? {delete: deleteMe} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <CompanyInputBox :company="patched" :validator="errors.validator" @patch:company="addPatch" />
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Company } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import CompanyInputBox from './CompanyInputBox.vue';

const props = withDefaults(
    defineProps<{
        company: Company;
        isNew: boolean;
        saveHandler: (group: AutoEncoderPatchType<Company>) => Promise<void>;
        deleteHandler?: (() => Promise<void>)|null;
    }>(),
    {
        deleteHandler: null
    }
);

const {patched, hasChanges, addPatch, patch} = usePatch(props.company);
const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const $t = useTranslate();
const pop = usePop();

const title = computed(() => {
    return props.isNew ? $t('Nieuwe facturatiegegevens') : $t('Facturatiegegevens bewerken');
});

async function save() {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true;
    try {
        errors.errorBox = null
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }
        await props.saveHandler(patch.value);
        await pop({force: true})
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        saving.value = false;
    }
}

async function deleteMe() {
    if (!await CenteredMessage.confirm($t('Ben je zeker dat je deze facturatiegegevens wilt verwijderen?'), $t('shared.confirmDelete'))) {
        return;
    }
    if (deleting.value || saving.value || !props.deleteHandler) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        await pop({force: true})
    } catch (e) {
        Toast.fromError(e).show();
    } finally {
        deleting.value = false;
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
})


</script>
