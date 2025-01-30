<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ viewTitle }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox title="Startdatum (inclusief)" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}" />
            </STInputBox>

            <STInputBox title="Einddatum (inclusief)" error-fields="endDate" :error-box="errors.errorBox">
                <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}" />
            </STInputBox>
        </div>
        <p class="style-description-small">
            Activiteiten die vallen binnen dit bereik moeten voldoen aan de deadline.
        </p>

        <div class="split-inputs">
            <STInputBox title="Deadline" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection v-model="deadlineDate" />
            </STInputBox>
            <TimeInput v-model="deadlineDate" title="Tijdstip" :validator="errors.validator" />
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, ErrorBox, SaveView, TimeInput, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { EventNotificationDeadline } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();

const props = defineProps<{
    deadline: EventNotificationDeadline;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<EventNotificationDeadline>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const viewTitle = computed(() => props.isNew ? $t('Nieuwe deadline') : $t('Wijzig deadline'));
const pop = usePop();

const { patched, addPatch, hasChanges, patch } = usePatch(props.deadline);

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
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

    if (!await CenteredMessage.confirm($t('Ben je zeker dat je deze deadline wilt verwijderen?'), $t('Ja, verwijderen'))) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

const startDate = computed({
    get: () => patched.value.startDate,
    set: startDate => addPatch({ startDate }),
});

const endDate = computed({
    get: () => patched.value.endDate,
    set: endDate => addPatch({ endDate }),
});

const deadlineDate = computed({
    get: () => patched.value.deadline,
    set: deadline => addPatch({ deadline }),
});

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
