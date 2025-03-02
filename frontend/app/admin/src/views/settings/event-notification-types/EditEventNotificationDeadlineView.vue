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

        <STInputBox :title="$t('Herinnering titel')" error-fields="reminderText" :error-box="errors.errorBox" class="max">
            <input
                v-model="reminderTitle"
                class="input"
                type="text"
                :placeholder="$t('bv. Dien je kampmeldingen voor je paaskampen in voor 1 maart')"
            >
        </STInputBox>

        <STInputBox :title="$t('Herinnering beschrijving')" error-fields="reminderText" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="reminderText"
                class="input"
                type="text"
                :placeholder="$t('bv. Ga naar je kamp in het tabblad Activiteiten (of maak het eerst aan) en klik op de knop om je kampmelding in te dienen')"
                autocomplete="off"
            />
        </STInputBox>
        <p class="style-description-small">
            Deze tekst is zichtbaar in het 'Start' tabblad als de deadline nadert.
        </p>

        <STInputBox title="Herinnering tonen vanaf" error-fields="reminderFrom" :error-box="errors.errorBox">
            <DateSelection v-model="reminderFrom" :required="false" :placeholder="$t('Als eerstsvolgende deadline')" :time="{hours: 0, minutes: 0, seconds: 0}" />
        </STInputBox>
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
const viewTitle = computed(() => props.isNew ? $t('59eba98e-b382-4075-af33-f8bf30b1042c') : $t('592f224e-5190-433c-a301-3fd2a11db105'));
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

    if (!await CenteredMessage.confirm($t('67494091-03bf-4700-a003-84f53dcea922'), $t('ba246326-994d-4133-9f85-5f693cdd2007'))) {
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

const reminderTitle = computed({
    get: () => patched.value.reminderTitle,
    set: reminderTitle => addPatch({ reminderTitle }),
});

const reminderText = computed({
    get: () => patched.value.reminderText,
    set: reminderText => addPatch({ reminderText }),
});

const reminderFrom = computed({
    get: () => patched.value.reminderFrom,
    set: reminderFrom => addPatch({ reminderFrom }),
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
