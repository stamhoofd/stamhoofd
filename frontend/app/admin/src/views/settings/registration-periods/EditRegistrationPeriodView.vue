<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox title="Startdatum" error-fields="settings.minAge" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>

            <STInputBox title="Einddatum" error-fields="settings.maxAge" :error-box="errors.errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>
        </div>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="locked" />
                </template>

                <h3 class="style-title-list">
                    Vergrendel inschrijvingen
                </h3>
                <p v-if="locked" class="style-description-small">
                    Lokale groepen kunnen niet langer wijzigingen aanbrengen aan inschrijvingen in dit werkjaar.
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr>
            <h2>
                {{ $t('admin.settings.registrationPeriods.delete.title') }}
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('shared.delete') }}</span>
            </button>
        </div>
    </SaveView>
</template>


<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, ErrorBox, SaveView, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { RegistrationPeriod } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();

const props = defineProps<{
    period: RegistrationPeriod;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<RegistrationPeriod>) => Promise<void>,
    deleteHandler: (() => Promise<void>)|null
}>();
const title = computed(() => props.isNew ? $t('admin.settings.registrationPeriods.new.title') : $t('admin.settings.registrationPeriods.edit.title'));
const pop = usePop();

const {patched, addPatch, hasChanges, patch} = usePatch(props.period);

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        await props.saveHandler(patch.value)
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm($t('admin.settings.registrationPeriods.delete.confirmation.title'), $t('shared.delete'), $t('admin.settings.registrationPeriods.delete.confirmation.description'))) {
        return
    }
        
    deleting.value = true;
    try {
        await props.deleteHandler()
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    deleting.value = false;
};

const startDate = computed({
    get: () => patched.value.startDate,
    set: (startDate) => addPatch({startDate}),
});

const endDate = computed({
    get: () => patched.value.endDate,
    set: (endDate) => addPatch({endDate}),
});

const locked = computed({
    get: () => patched.value.locked,
    set: (locked) => addPatch({locked}),
});

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    
    return await CenteredMessage.confirm($t('shared.save.shouldNavigateAway.title'), $t('shared.save.shouldNavigateAway.confirm'))
}

defineExpose({
    shouldNavigateAway
})
</script>
