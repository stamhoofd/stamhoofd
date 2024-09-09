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
    return props.isNew ? $t('2d998332-6028-4be3-aa81-fd0f34d00be7') : $t('119d091e-820f-46f0-91f0-5b036fa63e55');
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
    if (!await CenteredMessage.confirm($t('3f81e947-a0a3-4d21-81d7-3298e65d49b1'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'))) {
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
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'))
}

defineExpose({
    shouldNavigateAway
})


</script>
