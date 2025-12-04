<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ viewTitle }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`c6b66a83-8b28-46f8-bf0b-5052fbe57771`)">
                <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}" />
            </STInputBox>

            <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t(`40008cbb-d57f-4c0d-82ae-048a33fc8c12`)">
                <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}" />
            </STInputBox>
        </div>
        <p class="style-description-small">
            {{ $t('9db0c34d-8632-4b5c-8dc5-88cc6772baf8') }}
        </p>

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`0a2e758f-37b1-448a-a14f-a0548443faec`)">
                <DateSelection v-model="deadlineDate" />
            </STInputBox>
            <TimeInput v-model="deadlineDate" :validator="errors.validator" :title="$t(`7853cca1-c41a-4687-9502-190849405f76`)" />
        </div>

        <STInputBox :title="$t('9106b204-3db9-4fac-acfa-e53e07d5a867')" error-fields="reminderText" :error-box="errors.errorBox" class="max">
            <input v-model="reminderTitle" class="input" type="text" :placeholder="$t('16e52c0a-81e8-4d24-9efb-470a92b74c15')">
        </STInputBox>

        <STInputBox :title="$t('49706c38-6fcf-4533-8692-ccf5836a27df')" error-fields="reminderText" :error-box="errors.errorBox" class="max">
            <textarea v-model="reminderText" class="input" type="text" :placeholder="$t('55770076-d3a3-48db-a49b-ba23c6a54a39')" autocomplete="off" />
        </STInputBox>
        <p class="style-description-small">
            {{ $t("7d7b0a9e-deb7-4805-8a28-46277606626c") }}
        </p>

        <STInputBox error-fields="reminderFrom" :error-box="errors.errorBox" :title="$t(`35b36aa0-f27b-48f8-8751-4fe7b92ddeac`)">
            <DateSelection v-model="reminderFrom" :required="false" :placeholder="$t('ba2b2a5a-8c8a-42c5-9ee7-78daa3b6c5ec')" :time="{hours: 0, minutes: 0, seconds: 0}" />
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
