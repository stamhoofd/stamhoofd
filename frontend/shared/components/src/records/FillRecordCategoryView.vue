<template>
    <SaveView :loading="loading" :save-text="saveText" @save="save">
        <FillRecordCategoryBox :category="category" :value="patchedValue" :validator="errors.validator" @patch="addPatch" />
    </SaveView>
</template>

<script setup lang="ts" generic="T extends ObjectWithRecords">
import { PatchMap } from '@simonbackx/simple-encoding';
import { useDismiss, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { ObjectWithRecords, PatchAnswers, RecordCategory } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { NavigationActions } from '../types/NavigationActions';
import FillRecordCategoryBox from './components/FillRecordCategoryBox.vue';

const props = withDefaults(
    defineProps<{
        category: RecordCategory,
        value: T,
        patchHandler: (patch: PatchAnswers) => T,
        saveHandler: (patch: PatchAnswers, navigate: NavigationActions) => Promise<void>|void,
        saveText?: string,
    }>(), {
        saveText: 'Opslaan'
    }
);

const patch = ref(new PatchMap() as PatchAnswers)
const patchedValue = computed(() => {
    const patched = props.patchHandler(patch.value)
    return patched
});

function addPatch(p: PatchAnswers) {
    patch.value = p.applyTo(patch.value) as PatchAnswers
}

const show = useShow();
const present = usePresent();
const dismiss = useDismiss();
const pop = usePop();
const loading = ref(false);
const errors = useErrors()

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

        await props.saveHandler(patch.value, {
            show, present, dismiss, pop
        });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

const hasChanges = computed(() => {
    return patch.value.size > 0
})

async function shouldNavigateAway() {
    if (!hasChanges.value && !loading.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

defineExpose({
    shouldNavigateAway
})

</script>
