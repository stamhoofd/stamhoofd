<template>
    <STInputBox :title="title" error-fields="time" :error-box="errors.errorBox">
        <input v-model="timeRaw" class="input" type="time" :class="{ error: errors.errorBox !== null }" :placeholder="placeholder" :autocomplete="autocomplete" :disabled="disabled" @change="validate">
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';
import { computed, ref, watch } from 'vue';
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

const model = defineModel<Date | null>({ required: true });

const timeRawCache = ref(formatDate(model.value));

watch(model, (value) => {
    timeRawCache.value = formatDate(value);
});

const timeRaw = computed({
    get: () => timeRawCache.value,
    set: (value: string) => {
        timeRawCache.value = value?.trim().toLowerCase() ?? '';
    },
});

const errors = useErrors();

useValidation(errors.validator, validate);

function formatDate(date: Date | null): string {
    if (date === null) {
        return '';
    }

    return Formatter.timeIso(date);
}

function validate() {
    const timeValue = timeRawCache.value;

    const regex = /^([0-9]{1,2}:)?[0-9]{1,2}$/;

    if (!regex.test(timeValue)) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: "Ongeldig tijdstip. Voer in zoals bv. '12:30'",
            field: 'time',
        }));
        return false;
    }
    else {
        const split = timeValue.split(':');
        let hour = parseInt(split[0]);
        let minute = parseInt(split[1] ?? '0');

        if (isNaN(hour)) {
            hour = 0;
        }

        if (isNaN(minute)) {
            minute = 0;
        }

        if (hour > 24 || minute > 60) {
            errors.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: $t(`dce292b4-9edd-4e20-a2e3-e3be80d42eb4`),
                field: 'time',
            }));
            return false;
        }

        const luxonModelValue = DateTime.fromJSDate(model.value!).setZone(Formatter.timezone);
        model.value = DateTime.fromObject({ year: luxonModelValue.year, month: luxonModelValue.month, day: luxonModelValue.day, hour, minute, second: 0, millisecond: 0 },
            { zone: Formatter.timezone })
            .toJSDate();

        errors.errorBox = null;
        return true;
    }
}
</script>
