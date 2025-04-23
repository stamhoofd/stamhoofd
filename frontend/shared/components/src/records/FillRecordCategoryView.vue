<template>
    <SaveView :loading="loading" :save-text="saveText" @save="save">
        <FillRecordCategoryBox :category="category" :value="patchedValue" :validator="errors.validator" :force-mark-reviewed="forceMarkReviewed" @patch="addPatch" />
    </SaveView>
</template>

<script setup lang="ts" generic="T extends ObjectWithRecords">
import { PatchMap, patchObject } from '@simonbackx/simple-encoding';
import { ObjectWithRecords, PatchAnswers, RecordCategory } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { NavigationActions, useNavigationActions } from '../types/NavigationActions';
import FillRecordCategoryBox from './components/FillRecordCategoryBox.vue';

const props = withDefaults(
    defineProps<{
        category: RecordCategory;
        value: T;
        saveHandler: (patch: PatchAnswers, navigate: NavigationActions) => Promise<void> | void;
        saveText?: string;
        forceMarkReviewed?: boolean | null;
    }>(), {
        saveText: $t(`bc6b2553-c28b-4e3b-aba3-4fdc2c23db6e`),
        forceMarkReviewed: null,
    },
);

const patch = ref(new PatchMap() as PatchAnswers);
const patchedValue = computed(() => {
    const patched = props.value.patchRecordAnswers(patch.value);
    return patched;
});

function addPatch(p: PatchAnswers) {
    patch.value = patchObject(patch.value, p);
}

const loading = ref(false);
const errors = useErrors();
const navigate = useNavigationActions();

async function save() {
    if (loading.value) {
        return;
    }

    loading.value = true;

    try {
        if (!await errors.validator.validate()) {
            loading.value = false;
            return;
        }

        await props.saveHandler(patch.value, navigate);
        patch.value = new PatchMap() as PatchAnswers;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

const hasChanges = computed(() => {
    return patch.value.size > 0;
});

async function shouldNavigateAway() {
    if (!hasChanges.value && !loading.value) {
        return true;
    }
    return await CenteredMessage.confirm($t(`c9111e95-2f59-4164-b0af-9fbf434bf6dd`), $t(`de41b0f3-1297-4058-b390-3bfb99e3d4e0`));
}

defineExpose({
    shouldNavigateAway,
});

</script>
