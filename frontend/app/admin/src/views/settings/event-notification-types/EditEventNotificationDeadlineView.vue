<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ viewTitle }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`9073a7e1-327b-4b28-80fb-38120d64d3e7`)">
                <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}"/>
            </STInputBox>

            <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t(`c25b9f6c-4e40-4330-9ede-576c66686cb9`)">
                <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}"/>
            </STInputBox>
        </div>
        <p class="style-description-small">
            {{ $t('944b0f2f-d8ef-46c6-9156-4687b836b258') }}
        </p>

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`a62b3c20-4cc5-4f0f-ab64-05af382b98eb`)">
                <DateSelection v-model="deadlineDate"/>
            </STInputBox>
            <TimeInput v-model="deadlineDate" :validator="errors.validator" :title="$t(`93a310d9-c446-46ac-b2b6-663bfab3a0ad`)"/>
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
