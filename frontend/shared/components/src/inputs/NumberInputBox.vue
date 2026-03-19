<template>
    <STInputBox
        :title="title"
        :error-fields="errorFields"
        :error-box="errorBoxes"
        :class="props.class"
    >
        <NumberInput
            v-model="model"
            :min="min" :max="max" :stepper="stepper" :required="required" :disabled="disabled" :suffix="suffix" :suffix-singular="suffixSingular" :placeholder="placeholder" :floating-point="floatingPoint"
            :auto-fix="false"
        />
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { computed, watch } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useValidation } from '../errors/useValidation';
import type { Validator } from '../errors/Validator';
import NumberInput from './NumberInput.vue';
import STInputBox from './STInputBox.vue';
import { useNumberInput } from './useNumberInput';

const props = withDefaults(defineProps<{
    title?: string;
    errorFields?: string;
    class?: string | null;
    validator?: Validator | null;
    errorBox?: ErrorBox | null;

    /** Price in cents */
    min?: number | null;
    /** Price in cents */
    max?: number | null;
    stepper?: boolean;
    required?: boolean;
    disabled?: boolean;
    suffix?: string;
    suffixSingular?: string | null;
    placeholder?: string;
    floatingPoint?: boolean; // In cents if floating point, never returns floats!
}>(), {
    title: undefined,
    errorFields: 'number',
    class: null,
    validator: null,
    errorBox: null,
    min: null,
    max: null,
    stepper: false,
    required: true,
    disabled: false,
    suffix: '',
    suffixSingular: null,
    placeholder: '',
    floatingPoint: false,

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
    if (errors.errorBox) {
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
