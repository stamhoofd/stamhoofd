<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t('5d0d0da2-3c50-4ee5-9a44-68f4a65f76b3')" error-fields="notes" :error-box="errors.errorBox" class="max">
            <input v-model="customName" class="input" type="text" autocomplete="off" enterkeyhint="next" :maxlength="200" :placeholder="patched.name">
        </STInputBox>

        <p v-if="!isValidCustomName" class="warning-box">
            {{ $t('0838734b-4388-49e9-b96b-ad15883a219b') }}
        </p>

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`33a674c2-6981-442b-9bd4-01f71da7a159`)">
                <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}" />
            </STInputBox>

            <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t(`f852932e-380e-4b9a-916b-2bc008d8c08a`)">
                <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}" :min="startDate" />
            </STInputBox>
        </div>

        <STList v-if="locked || !isCurrentPeriod">
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="locked" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('6a297067-37ee-43f3-bffc-07968cf321c2') }}
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
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, ErrorBox, SaveView, useErrors, usePatch, usePlatform, useValidation } from '@stamhoofd/components';
import { RegistrationPeriod } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    period: RegistrationPeriod;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<RegistrationPeriod>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();

const platform = usePlatform();
const isCurrentPeriod = computed(() => platform.value.period.id === props.period.id);
const title = computed(() => props.isNew ? $t('c6f24e63-4735-43c4-a93a-405755ba70c2') : $t('7118def6-da94-4fce-9398-2131b31acf01'));
const pop = usePop();

const { patched, addPatch, hasChanges, patch } = usePatch(props.period);

useValidation(errors.validator, validate);

function validate() {
    if (patched.value.endDate.getTime() < patched.value.startDate.getTime()) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            field: 'endDate',
            message: $t('186723cd-2cd4-45fd-aa9c-020c9d92b225'),
        }));

        return false;
    }

    errors.errorBox = null;
    return true;
}

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }
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

const customName = computed({
    get: () => patched.value.customName,
    set: (value: string) => {
        if (!value || value.trim().length === 0) {
            addPatch({ customName: null });
        }
        else {
            addPatch({ customName: value });
        }
    },
});

const startDate = computed({
    get: () => patched.value.startDate,
    set: startDate => addPatch({ startDate }),
});

const endDate = computed({
    get: () => patched.value.endDate,
    set: endDate => addPatch({ endDate }),
});

const isValidCustomName = computed(() => {
    if (!customName.value) {
        return true;
    }

    const startYear = startDate.value.getFullYear();
    const endYear = endDate.value.getFullYear();

    // skip extreme cases
    if (startYear < 1900 || endYear > 9999 || startYear > endYear) {
        return true;
    }

    // should contain year between start and end dates (start and end dates included)
    for (let i = startYear; i <= endYear; i++) {
        if (customName.value.includes(i.toString().substring(2))) {
            return true;
        }
    }

    return false;
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
