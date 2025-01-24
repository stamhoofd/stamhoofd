<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox title="Startdatum" error-fields="settings.minAge" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}" />
            </STInputBox>

            <STInputBox title="Einddatum" error-fields="settings.maxAge" :error-box="errors.errorBox">
                <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}" />
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
                    {{ $t('cc48e00f-2c6b-4f4d-9bae-65a889364ea3') }}
                </p>
            </STListItem>
        </STList>
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
    saveHandler: (p: AutoEncoderPatchType<RegistrationPeriod>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const title = computed(() => props.isNew ? $t('c6f24e63-4735-43c4-a93a-405755ba70c2') : $t('7118def6-da94-4fce-9398-2131b31acf01'));
const pop = usePop();

const { patched, addPatch, hasChanges, patch } = usePatch(props.period);

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

    if (!await CenteredMessage.confirm($t('ca303b26-d586-4e46-ad0d-af968d252261'), $t('838cae8b-92a5-43d2-82ba-01b8e830054b'), $t('2e055510-5527-45f9-8ed7-7d8f8cd03a4f'))) {
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

const locked = computed({
    get: () => patched.value.locked,
    set: locked => addPatch({ locked }),
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
