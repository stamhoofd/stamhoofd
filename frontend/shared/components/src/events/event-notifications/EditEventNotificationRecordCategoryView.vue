<template>
    <SaveView :title="title" :loading="saving" :prefer-large-button="true" @save="save">
        <FillRecordCategoryBox :category="category" :value="patched" :validator="errors.validator" :level="1" :all-optional="false" :force-mark-reviewed="true" @patch="addPatch({recordAnswers: $event})">
            <STErrorsDefault :error-box="errors.errorBox" />
        </FillRecordCategoryBox>

        <template v-if="canSaveDraft" #toolbar>
            <button class="button secundary" type="button" @click="saveDraft">
                {{ $t('650e0758-203c-474f-8b51-da33f39de29c') }}
            </button>
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { useDismiss, usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, FillRecordCategoryBox, NavigationActions, useErrors, useNavigationActions } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { RecordCategory } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { EventNotificationViewModel } from './classes/EventNotificationViewModel';

const props = withDefaults(
    defineProps<{
        viewModel: EventNotificationViewModel;
        category: RecordCategory;
        saveHandler?: ((navigate: NavigationActions) => Promise<void> | void) | null;
        skipHandler?: ((navigate: NavigationActions) => Promise<void> | void) | null;
    }>(), {
        saveHandler: null,
        skipHandler: null,
    },
);

const errors = useErrors();
const { hasChanges, patched, addPatch, patch } = props.viewModel.usePatch();
const title = computed(() => props.category.name);
const saving = ref(false);

const pop = usePop();
const { save: saveModel } = props.viewModel.useSave();
const navigationActions = useNavigationActions();
const dismiss = useDismiss();
const canSaveDraft = ref(false);

async function saveDraft() {
    if (saving.value) {
        return;
    }

    errors.errorBox = null;
    saving.value = true;

    try {
        await saveModel(patch.value);

        if (props.skipHandler) {
            await props.skipHandler(navigationActions);
        }
        else {
            await dismiss({ force: true });
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

async function save() {
    if (saving.value) {
        return;
    }

    errors.errorBox = null;

    saving.value = true;

    if (!await errors.validator.validate()) {
        // Save as draft
        canSaveDraft.value = true;

        saving.value = false;
        return;
    }

    try {
        await saveModel(patch.value);
        if (props.saveHandler) {
            await props.saveHandler(navigationActions);
        }
        else {
            await pop({ force: true });
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
