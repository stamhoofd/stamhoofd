<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t('%1Os')" error-fields="notes" :error-box="errors.errorBox" class="max">
            <input v-model="customName" class="input" type="text" autocomplete="off" enterkeyhint="next" :maxlength="200" :placeholder="patched.name">
        </STInputBox>

        <p v-if="!isValidCustomName" class="warning-box">
            {{ $t('%1Gy') }}
        </p>

        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`%1Of`)">
                <DateSelection v-model="startDate" :time="{hours: 0, minutes: 0, seconds: 0}" />
            </STInputBox>

            <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t(`%1P8`)">
                <DateSelection v-model="endDate" :time="{hours: 23, minutes: 59, seconds: 59}" :min="startDate" />
            </STInputBox>
        </div>

        <STList v-if="locked || !isCurrentPeriod">
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="locked" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%IT') }}
                </h3>
                <p v-if="locked" class="style-description-small">
                    {{ $t('%8K') }}
                </p>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import DateSelection from '#inputs/DateSelection.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import SaveView from '#navigation/SaveView.vue';
import { useErrors } from '#errors/useErrors.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useValidation } from '#errors/useValidation.ts';
import type { RegistrationPeriod } from '@stamhoofd/structures';
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
const title = computed(() => props.isNew ? $t('%3h') : $t('%3f'));
const pop = usePop();

const { patched, addPatch, hasChanges, patch } = usePatch(props.period);

useValidation(errors.validator, validate);

function validate() {
    if (patched.value.endDate.getTime() < patched.value.startDate.getTime()) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            field: 'endDate',
            message: $t('%1Gv'),
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

    if (!await CenteredMessage.confirm($t('%3d'), $t('%CJ'), $t('%3c'))) {
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

    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
