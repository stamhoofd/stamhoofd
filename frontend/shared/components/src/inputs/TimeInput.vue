<template>
    <STInputBox :title="title" error-fields="time" :error-box="errors.errorBox">
        <input v-model="timeRaw" class="input" type="time" :class="{ error: errors.errorBox !== null }" :placeholder="placeholder" :autocomplete="autocomplete" :disabled="disabled">
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useValidation } from '../errors/useValidation';
import { Validator } from '../errors/Validator';
import STInputBox from './STInputBox.vue';

withDefaults(defineProps<{
    title?: string;
    validator?: Validator | null;
    disabled?: boolean;
    placeholder?: string;
    autocomplete?: string;
}>(), {
    title: '',
    validator: null,
    disabled: false,
    placeholder: '',
    autocomplete: '',
});

const isNull = ref(false);
const model = defineModel<Date>({ required: true, set: (value: Date) => {
    isNull.value = false;
    return value;
} });

const timeRaw = computed({
    get: () => isNull.value || model.value === null ? '' : Formatter.timeIso(model.value),
    set: (value: string) => validate(value),
});

const errors = useErrors();

useValidation(errors.validator, () => onChange());

function onChange() {
    return validate(timeRaw.value);
}

function validate(timeValue: string | null) {
    timeValue = timeValue?.trim().toLowerCase() ?? '';

    const regex = /^([0-9]{1,2}:)?[0-9]{1,2}$/;

    if (!regex.test(timeValue)) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: "Ongeldig tijdstip. Voer in zoals bv. '12:30'",
            field: 'time',
        }));
        if (!isNull.value) {
            isNull.value = true;
        }
        return false;
    }
    else {
        const split = timeValue.split(':');
        let hours = parseInt(split[0]);
        let minutes = parseInt(split[1] ?? '0');

        if (isNaN(hours)) {
            hours = 0;
        }

        if (isNaN(minutes)) {
            minutes = 0;
        }

        if (hours > 24 || minutes > 60) {
            errors.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: $t(`dce292b4-9edd-4e20-a2e3-e3be80d42eb4`),
                field: 'time',
            }));
            return false;
        }

        const d = new Date(model.value!.getTime());
        d.setHours(hours, minutes, 0, 0);
        model.value = d;

        errors.errorBox = null;
        return true;
    }
}
</script>
