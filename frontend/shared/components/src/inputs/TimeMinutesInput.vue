<template>
    <STInputBox :title="title" error-fields="time" :error-box="errors.errorBox">
        <input v-model="timeRaw" class="input" :class="{ error: errors.errorBox !== null }" type="time" :placeholder="placeholder" :autocomplete="autocomplete" :disabled="disabled" @change="validate">
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, watch } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useValidation } from '../errors/useValidation';
import { Validator } from '../errors/Validator';
import STInputBox from './STInputBox.vue';

const props = withDefaults(defineProps<{
    title?: string;
    validator?: Validator | null;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    autocomplete?: string;
}>(), {
    title: '',
    validator: null,
    required: true,
    disabled: false,
    placeholder: '',
    autocomplete: '',
});

const model = defineModel<number | null>({ default: null, set: (value: number | null) => {

    // prevent emitting null if required
    if (props.required && value === null) {
        return model.value;
    }

    return value;
} });

const timeRawCache = ref(formatMinutes(model.value));

watch(model, (value) => {
    if(value === null) {
        return;
    }
    
    timeRawCache.value = formatMinutes(value);
});

const timeRaw = computed({
    get: () => timeRawCache.value,
    set: (value: string) => {
        timeRawCache.value = value?.trim().toLowerCase() ?? '';
    },
});

const errors = useErrors();

useValidation(errors.validator, validate);

function formatMinutes(minutes: number | null): string {
    if(minutes === null) {
        return '';
    }

    return Formatter.minutesPadded(minutes);
}

function validate(): boolean {
    const timeValue = timeRawCache.value;

    if (!props.required && timeValue.length === 0) {
        errors.errorBox = null;

        if (model.value !== null) {
            model.value = null;
        }
        return true;
    }

    const regex = /^([0-9]{1,2}:)?[0-9]{1,2}$/;

    if (!regex.test(timeValue)) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: $t(`dce292b4-9edd-4e20-a2e3-e3be80d42eb4`),
            field: 'time',
        }));
        if (model.value !== null) {
            model.value = null;
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

        const time = Math.max(0, Math.min(hours * 60 + minutes, 24 * 60 - 1));

        if (time !== model.value) {
            model.value = time;
        }
        errors.errorBox = null;
        return true;
    }
}
</script>
