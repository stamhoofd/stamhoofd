<template>
    <STInputBox :title="title" error-fields="birthDay" :error-box="errors.errorBox">
        <div class="input birth-day-selection">
            <div class="input-icon-container right icon arrow-down-small gray">
                <select v-model="day" autocomplete="bday-day" name="bday-day" data-testid="day-select" @change="updateDate">
                    <!-- name is needed for autocomplete in safari -->
                    <option :disabled="required" :value="null">
                        {{ $t('9ea48ee8-ed13-43f7-a900-82630b911b7a') }}
                    </option>
                    <option v-for="day in 31" :key="day" :value="day" autocomplete="bday-day">
                        {{ day }}
                    </option>
                </select>
            </div>

            <div class="input-icon-container right icon arrow-down-small gray">
                <select v-model="month" autocomplete="bday-month" name="bday-month" data-testid="month-select" @change="updateDate">
                    <option :disabled="required" :value="null">
                        {{ $t('30a79bd4-2e8d-4bd4-97be-f23d04c337c8') }}
                    </option>
                    <option v-for="month in 12" :key="month" :value="month" autocomplete="bday-month">
                        {{ monthText(month) }}
                    </option>
                </select>
            </div>

            <div class="input-icon-container right icon arrow-down-small gray">
                <select v-model="year" autocomplete="bday-year" name="bday-year" data-testid="year-select" @change="updateDate">
                    <option :disabled="required" :value="null">
                        {{ $t('f88a59b7-e4ab-453b-96f2-8b1b60cb2fc0') }}
                    </option>
                    <option v-for="year in 100" :key="year" :value="currentYear - year + 1" autocomplete="bday-year">
                        {{ currentYear - year + 1 }}
                    </option>
                </select>
            </div>
        </div>
        <template #right>
            <slot name="right" />
        </template>
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';

import { ref, watch } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useValidation } from '../errors/useValidation';
import { Validator } from '../errors/Validator';
import STInputBox from './STInputBox.vue';

const props = withDefaults(defineProps<{
    title: string;
    required: boolean;
    validator: Validator | null;
}>(), {
    title: '',
    required: true,
    validator: null,
});

const model = defineModel<Date | null>({ default: null });

const errors = useErrors({ validator: props.validator });

const day = ref(model.value?.getDate() ?? null);
const month = ref(model.value ? model.value.getMonth() + 1 : null);
const year = ref(model.value?.getFullYear() ?? null);
const currentYear = new Date().getFullYear();

useValidation(errors.validator, validate);

watch(() => model.value, (val: Date | null) => {
    if (val) {
        day.value = val.getDate();
        month.value = val.getMonth() + 1;
        year.value = val.getFullYear();
    }
    else {
        day.value = null;
        month.value = null;
        year.value = null;
    }
});

function monthText(month: number) {
    return Formatter.month(month);
}

function updateDate() {
    if (year.value && month.value && day.value) {
        model.value = new Date(year.value, month.value - 1, day.value, 12);
    }
    else {
        model.value = null;
    }
}

function validate() {
    if (year.value && month.value && day.value) {
        if (!model.value) {
            model.value = new Date(year.value, month.value - 1, day.value, 12);
        }
        errors.errorBox = null;
        return true;
    }

    if (!props.required) {
        errors.errorBox = null;

        if (model.value !== null) {
            model.value = null;
        }
        return true;
    }

    if (model.value !== null) {
        model.value = null;
    }

    errors.errorBox = new ErrorBox(new SimpleError({
        code: 'empty_field',
        message: $t(`a8a86928-92f9-41f2-bf1c-7e193b59e06c`),
        field: 'birthDay',
    }));

    return false;
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;
@use "@stamhoofd/scss/base/variables.scss" as *;

.input.birth-day-selection {
    padding-right: 0;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto;
    align-items: stretch;

    > div {
        display: flex;
        align-items: stretch;

        > select {
            @extend .style-input;
            color: $color-dark;
        }

        // Remove dotted line in Firefox
        > select:-moz-focusring {
            color: transparent;
            text-shadow: 0 0 0 #000;
        }
    }

}
</style>
