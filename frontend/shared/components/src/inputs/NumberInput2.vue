<template>
    <div class="number-container">
        <label class="number-input input" :class="{ error: !isValid, disabled: disabled }">
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
                @blur="restoreTextValue"
                @keydown.up.prevent="step(1)"
                @keydown.down.prevent="step(-1)"
            >
            <div v-if="!isValid">
                <span>{{ textValue }}</span>
            </div>
            <div v-else-if="textValue === ''">
                {{ placeholder }}
            </div>
            <div v-else>
                <span>{{ textValue }}</span> {{ modelValue === 1 && suffixSingular !== null ? suffixSingular : suffix }}
            </div>
        </label>
        <StepperInput v-if="stepper" v-model="stepperValue" :min="min" :max="max" />
    </div>
</template>

<script lang="ts" setup>

import { computed, ref, useTemplateRef, watch } from 'vue';
import StepperInput from './StepperInput.vue';

const props = withDefaults(defineProps<{
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
    modelValue: number | null;
}>(), {
    min: null,
    max: null,
    stepper: false,
    required: true,
    disabled: false,
    suffix: '',
    suffixSingular: null,
    placeholder: '',
    floatingPoint: false,
    modelValue: null,

});

const emit = defineEmits(['update:modelValue']);

const inputEl = useTemplateRef<HTMLInputElement>('input');
const textValue = ref(numberToString(props.modelValue));
const numberValue = computed(() => getNumberValueFromText(textValue.value));
const isValid = computed(() => numberValue.value.isValid);

const stepperValue = computed({
    get: () => props.modelValue ?? props.min ?? 0,
    set: (value: number) => setModelValue(value),
});

watch(() => props.modelValue, () => restoreTextValue());

watch(numberValue, ({ isValid, value, isValidIfConstrained }) => {
    if (isValid || isValidIfConstrained) {
        if (isFocused()) {
            setModelValue(value);
        }
    }
});

function isFocused(): boolean {
    const inputElement = inputEl.value;
    if (inputElement) {
        const activeElement = (('getRootNode' in inputElement ? (inputElement.getRootNode() ?? document) : document) as any).activeElement as HTMLElement;

        if (inputElement === activeElement) {
            return true;
        }
    }

    return false;
}

function getNumberValueFromText(value: string): { isValid: boolean; value: number | null; isValidIfConstrained?: boolean } {
    if (!value.length) {
        if (props.required) {
            return {
                isValid: false,
                value: constrain(0),
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
            value: constrain(0),
        };
    }

    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
        return {
            isValid: false,
            value: constrain(0),
        };
    }

    const corrected = Math.round(parsed * (props.floatingPoint ? 100 : 1));
    const constrained = constrain(corrected);

    if (constrained !== corrected) {
        return {
            isValid: false,
            value: constrained,
            isValidIfConstrained: true,
        };
    }

    return {
        isValid: true,
        value: corrected,
    };
}

// function textValueToNumber(value: string): number | null {
//     if (!value.length) {
//         return null;
//     }

//     if (!value.includes('.')) {
//         // We do this for all locales since some browsers report the language locale instead of the formatting locale
//         value = value.replace(',', '.');
//     }

//     const parsed = parseFloat(value);
//     if (isNaN(parsed)) {
//         return 0;
//     }

//     return Math.round(parsed * (props.floatingPoint ? 100 : 1));
// }

// function emitFilteredValue(value: number | null) {
//     if (typeof value !== 'number' || isNaN(value)) {
//         if (props.required) {
//             emitFilteredValue(0);
//             return;
//         }

//         emit('update:modelValue', null);
//         return;
//     }

//     emit('update:modelValue', constrain(value));
// }

function restoreTextValue() {
    const valueAsString = numberToString(props.modelValue);
    if (valueAsString !== textValue.value) {
        textValue.value = valueAsString;
    }
}

function numberToString(value: number | null) {
    if (value === null) {
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
            + whatDecimalSeparator()
            + ('' + Math.round(Math.abs(decimals) * (props.floatingPoint ? 100 : 1))).padStart(2, '0');
    }
    else {
        // Hide decimals
        return float + '';
    }
}

/// Returns the decimal separator of the system. Might be wrong if the system has a region set different from the language with an unknown combination.
function whatDecimalSeparator(): string {
    const n = 1.1;
    const str = n.toLocaleString().substring(1, 2);
    return str;
}

function setModelValue(value: number | null) {
    emit('update:modelValue', (value));
}

// Limit value to bounds
function constrain(value: number): number {
    if (props.min !== null && value < props.min) {
        value = props.min;
    }
    else if (props.max !== null && value > props.max) {
        value = props.max;
    }
    return value;
}

function step(add: number) {
    const currentValue = (props.modelValue ?? props.min ?? 0);
    const newValue = currentValue + add;
    emit('update:modelValue', constrain(newValue));
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
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
