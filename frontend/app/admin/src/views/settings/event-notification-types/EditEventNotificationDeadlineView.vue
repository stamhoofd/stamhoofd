<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ viewTitle }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`%Hs`)">
                <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}" />
            </STInputBox>

            <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t(`%Ht`)">
                <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}" />
            </STInputBox>
        </div>
        <p class="style-description-small">
            {{ $t('%Hq') }}
        </p>

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`%N`)">
                <DateSelection v-model="deadlineDate" />
            </STInputBox>
            <TimeInput v-model="deadlineDate" :validator="errors.validator" :title="$t(`%1GD`)" />
        </div>

        <STInputBox :title="$t('%CB')" error-fields="reminderText" :error-box="errors.errorBox" class="max">
            <input v-model="reminderTitle" class="input" type="text" :placeholder="$t('%CC')">
        </STInputBox>

        <STInputBox :title="$t('%CD')" error-fields="reminderText" :error-box="errors.errorBox" class="max">
            <textarea v-model="reminderText" class="input" type="text" :placeholder="$t('%CE')" autocomplete="off" />
        </STInputBox>
        <p class="style-description-small">
            {{ $t("%Hr") }}
        </p>

        <STInputBox error-fields="reminderFrom" :error-box="errors.errorBox" :title="$t(`%Hu`)">
            <DateSelection v-model="reminderFrom" :required="false" :placeholder="$t('%CF')" :time="{hours: 0, minutes: 0, seconds: 0}" />
        </STInputBox>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import TimeInput from '@stamhoofd/components/inputs/TimeInput.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { EventNotificationDeadline } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    deadline: EventNotificationDeadline;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<EventNotificationDeadline>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const viewTitle = computed(() => props.isNew ? $t('%8d') : $t('%8e'));
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

    if (!await CenteredMessage.confirm($t('%8f'), $t('%55'))) {
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

    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
