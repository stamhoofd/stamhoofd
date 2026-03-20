<template>
    <STInputBox
        :title="title"
        :error-fields="errorFields"
        :error-box="errorBoxes"
        :class="props.class"
    >
        <div class="number-container">
            <label class="number-input input" :class="{ disabled: disabled }">
                <!--
                We use type = text here because the specs of number inputs ensure that we can't get
                the raw string value, but we need this for our placeholder logic.
                Also inputmode is more specific on mobile devices.
                Only downside is that we lose the stepper input on desktop.
            -->
                <input
                    v-model="textValue"
                    :disabled="disabled"
                    type="text"
                    :inputmode="floatingPoint ? 'decimal' : 'numeric'"
                    step="any"
                    @keydown.up.prevent="step(1)"
                    @keydown.down.prevent="step(-1)"
                    @change="() => validateAndUpdateModel({final: true, silent: false})"
                    @input="() => validateAndUpdateModel({final: false, silent: true})"
                >
                <div v-if="!textValue.length">
                    {{ placeholder }}
                </div>
                <div v-else>
                    <span>{{ textValue }}</span> {{ modelValue === 1 && suffixSingular !== null ? suffixSingular : suffix }}
                </div>
            </label>
            <StepperInput v-if="stepper" v-model="stepperValue" :min="min" :max="max" />
        </div>
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { computed, ref, watch } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useValidation } from '../errors/useValidation';
import { Validator } from '../errors/Validator';
import StepperInput from './StepperInput.vue';
import STInputBox from './STInputBox.vue';

const props = withDefaults(defineProps<{
    title?: string;
    errorFields?: string;
    class?: string | null;
    validator: Validator | null;
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

const model = defineModel<number | null>({ default: null });

const errors = useErrors({ validator: props.validator });
useValidation(errors.validator, validateAndUpdateModel);

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

const textValue = ref(numberToString(model.value));
const textValidationResult = computed(() => validateText(textValue.value));

const stepperValue = computed({
    get: () => textValidationResult.value.value ?? props.min ?? 0,
    set: (value: number) => {
        const text = numberToString(value);
        if (text !== textValue.value) {
            textValue.value = text;
            validateAndUpdateModel({ final: true, silent: false });
        }
    },
});

watch(() => model.value, (value) => {
    const valueAsString = numberToString(value);
    if (valueAsString !== textValue.value) {
        textValue.value = valueAsString;
        validateAndUpdateModel({ silent: true, final: true });
    }
},
);

function validateText(value: string): { isValid: false; errorMessage: string; isValidIfConstrained?: boolean; value: number | null } | { isValid: true; value: number | null } {
    if (!value.length) {
        if (props.required) {
            return {
                isValid: false,
                errorMessage: $t(`%qt`),
                value: null,
            };
        }
        return {
            isValid: true,
            value: null,
        };
    }

    if (!value.includes('.')) {
        // We do this for all locales since some browsers report the language locale instead of the formatting locale
        value = value.replace(',', '.');
    }

    if (isNaN(parseInt(value))) {
        return {
            isValid: false,
            errorMessage: $t(`Vul een geldig getal in`),
            value: null,
        };
    }

    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
        return {
            isValid: false,
            errorMessage: $t(`Vul een geldig getal in`),
            value: null,
        };
    }

    const corrected = Math.round(parsed * (props.floatingPoint ? 100 : 1));
    const constrainedResult = validateConstraints(corrected);

    if (!constrainedResult.isValid) {
        return {
            ...constrainedResult,
            isValidIfConstrained: true,
            value: corrected,
        };
    }

    return {
        isValid: true,
        value: corrected,
    };
}

function validateConstraints(value: number): { isValid: false; errorMessage: string; value: number } | { isValid: true; value: number } {
    if (props.min !== null && value < props.min) {
        return {
            isValid: false,
            errorMessage: $t(`Het minimum is {min}`, { min: props.min }),
            value: props.min,
        };
    }

    if (props.max !== null && value > props.max) {
        return {
            isValid: false,
            errorMessage: $t(`Het maximum is {max}`, { max: props.max }),
            value: props.max,
        };
    }

    return {
        isValid: true,
        value,
    };
}

function numberToString(value: number | null) {
    if (value === null || isNaN(value)) {
        return '';
    }

    // Check if has decimals
    const float = value / (props.floatingPoint ? 100 : 1);
    const decimals = float % 1;
    const abs = Math.abs(float);

    if (decimals !== 0) {
        // Include decimals
        return (float < 0 ? '-' : '')
            + Math.floor(abs)
            + getDecimalSeparator()
            + ('' + Math.round(Math.abs(decimals) * (props.floatingPoint ? 100 : 1))).padStart(2, '0');
    }

    // Hide decimals
    return float + '';
}

/**
 * Returns the decimal separator of the system. Might be wrong if the system has a region set different from the language with an unknown combination.
 */
function getDecimalSeparator(): string {
    const n = 1.1;
    const str = n.toLocaleString().substring(1, 2);
    return str;
}

function setModelValue(value: number | null) {
    if (value !== model.value) {
        model.value = value;
    }
}

function step(add: number) {
    const currentValue = (model.value ?? props.min ?? 0);
    const newValue = currentValue + add;

    const constainedResult = validateConstraints(newValue);
    setModelValue(constainedResult.value);
}

function validateAndUpdateModel({ silent, final }: { silent: boolean; final: boolean } = { silent: false, final: true }) {
    const result = textValidationResult.value;

    if (result.isValid) {
        if (!silent) {
            errors.errorBox = null;
        }

        setModelValue(result.value);
        return true;
    }

    if (!silent) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: result.errorMessage,
            field: props.errorFields,
        }));
    }

    if (final) {
        setModelValue(result.value);
    }

    return false;
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.number-container {
    display: flex;

    &.option {
        margin-top: 7px
    }

    .number-input {
        min-width: 0;
    }

    .stepper-input {
        margin-left: 5px;
        min-width: 0;
        flex-shrink: 0;
    }

    & + .style-description-small, & + .style-description, + div:not([class]) > .style-description-small:first-child {
        padding-top: 5px;
        padding-bottom: 15px;
    }
}
.number-input {
    position: relative;

    & > div {
        pointer-events: none;
        user-select: none;
        white-space: nowrap;

        span {
            white-space: pre;
        }
    }

    .placeholder {
        color: $color-gray-5;
        opacity: 1;
    }

    & > input {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        opacity: 0;
        width: 100%;
        box-sizing: border-box;
        padding: 5px 15px;
        height:  calc(#{$input-height} - 2 * #{$border-width});
        line-height: calc(#{$input-height} - 10px - 2 * #{$border-width});

        &:focus {
            opacity: 1;

            & + div {
                opacity: 0.5;

                span {
                    visibility: hidden;
                }
            }
        }
    }
}
</style>
