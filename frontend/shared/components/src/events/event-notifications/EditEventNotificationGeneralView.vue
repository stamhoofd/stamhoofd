<template>
    <SaveView :title="viewModel.type.title" :prefer-large-button="true" :loading="saving" :save-text="viewModel.isNew ? $t('Beginnen') : $t('Opslaan')" save-icon-right="arrow-right" @save="save">
        <h1>
            {{ viewModel.type.title }}
        </h1>
        <p class="pre-wrap style-description-block" v-text="viewModel.type.description" />

        <STErrorsDefault :error-box="errors.errorBox" />

        <!-- todo: hier komt eigenlijk een soort van bevestigingsscherm voor niewue kampmeldingen.
        Hier kan je ook algemen instellingen wijzigen als die er nog komen
        In de toekomst kan je hier meerdere activiteiten koppelen aan dezelfde kampmelding -->
    </SaveView>
</template>

<script setup lang="ts">
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, NavigationActions, useErrors, useNavigationActions } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { ref } from 'vue';
import { EventNotificationViewModel } from './classes/EventNotificationViewModel';

const props = withDefaults(
    defineProps<{
        viewModel: EventNotificationViewModel;
        saveHandler?: ((navigate: NavigationActions) => Promise<void> | void) | null;
    }>(), {
        saveHandler: null,
    },
);

const errors = useErrors();
const { hasChanges, patched, addPatch, patch } = props.viewModel.usePatch();
const saving = ref(false);
const $t = useTranslate();
const pop = usePop();
const { save: saveModel } = props.viewModel.useSave();
const navigationActions = useNavigationActions();

async function save() {
    if (saving.value) {
        return;
    }

    errors.errorBox = null;

    saving.value = true;

    if (!await errors.validator.validate()) {
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
