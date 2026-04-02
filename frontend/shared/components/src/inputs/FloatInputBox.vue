<template>
    <STInputBox
        :title="title"
        :error-fields="errorFields"
        :error-box="errorBoxes"
        :class="props.class"
    >
        <FloatInput
            v-model="model"
            :min="min" :max="max" :required="required" :disabled="disabled" :suffix="suffix" :placeholder="placeholder" :fraction-digits="fractionDigits" :round-fraction-digits="roundFractionDigits"
            :auto-fix="false"
        >
            <template #right>
                <slot name="input-right" />
            </template>
        </FloatInput>
        <template #right>
            <slot name="box-right" />
        </template>
        <slot />
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { computed, watch } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useValidation } from '../errors/useValidation';
import type { Validator } from '../errors/Validator';
import FloatInput from './FloatInput.vue';
import STInputBox from './STInputBox.vue';
import { useNumberInput } from './useNumberInput';

const props = withDefaults(defineProps<{
    title?: string;
    errorFields?: string;
    class?: string | null;
    validator: Validator | null;
    errorBox?: ErrorBox | null;

    min?: number | null;
    max?: number | null;
    placeholder?: string;
    suffix?: string;
    disabled?: boolean;
    required?: boolean;

    /**
     * Defines how the values are stored as integers.
     *
     * 2 means that a value of 1 represents 0,01
     * 4 means that a value of 1 represents 0,0001
     */
    fractionDigits?: number;

    /**
     * Maximum decimal places to allow.
     * E.g. fraction digits is set to 4, but you won't allow values smaller than 0,01, set this to 2 (= maximum).
     * when fraction digits is set to 4 and round fraction digits is set to 0, it will round all fractions (0,5 becomes 1)
     */
    roundFractionDigits?: number | null;
}>(), {
    title: undefined,
    errorFields: 'number',
    class: null,
    errorBox: null,
    min: null,
    max: null,
    placeholder: '',
    suffix: '',
    disabled: false,
    required: true,
    fractionDigits: 2,
    roundFractionDigits: null

});
const numberInput = useNumberInput(computed(() => props));

const errors = useErrors({ validator: props.validator });
const model = defineModel<number | null>({ default: null });

watch(model, validate);

useValidation(errors.validator, () => {
    return validate(model.value);
});

const errorBoxes = computed(() => {
    const arr: ErrorBox[] = [];
    if (props.errorBox) {
        arr.push(props.errorBox);
    }
    // prevent duplicate messages
    if (errors.errorBox && !arr.some(e => e.errors.message === errors.errorBox?.errors.message)) {
        arr.push(errors.errorBox);
    }
    return arr.length > 0 ? arr : null;
});

function validate(value: number | null): boolean {
    const result = numberInput.validateNumber(value);

    if (result.isValid) {
        errors.errorBox = null;
        return true;
    }

    errors.errorBox = new ErrorBox(new SimpleError({
        code: 'invalid_field',
        message: result.errorMessage,
        field: props.errorFields,
    }));

    return false;
}
</script>
