<template>
    <div class="number-container">
        <label class="number-input input" :class="{ error: !valid, disabled: disabled }">
            <!--
                We use type = text here because the specs of number inputs ensure that we can't get
                the raw string value, but we need this for our placeholder logic.
                Also inputmode is more specific on mobile devices.
                Only downside is that we lose the stepper input on desktop.
            -->
            <input
                ref="input"
                v-model="valueString"
                :disabled="disabled"
                type="text"
                :inputmode="floatingPoint ? 'decimal' : 'numeric'"
                step="any"
                @blur="clean"
                @keydown.up.prevent="step(1)"
                @keydown.down.prevent="step(-1)"
            >
            <div v-if="!valid">
                <span>{{ valueString }}</span>
            </div>
            <div v-else-if="valueString !== ''">
                <span>{{ valueString }}</span> {{ internalValue === 1 && suffixSingular !== null ? suffixSingular : suffix }}
            </div>
            <div v-else class="placeholder">{{ placeholder }}</div>
        </label>
        <StepperInput v-if="stepper" v-model="stepperValue" :min="min" :max="max" />
    </div>
</template>

<script lang="ts" setup>

import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
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

});

const inputEl = useTemplateRef<HTMLInputElement>('input');

const valueString = ref('');
const valid = ref(true);

/** Price in cents */
const model = defineModel<number | null>({ default: 0 });

watch(model, () => {
    clean();
}, { immediate: true });

const internalValue = computed({
    get: () => model.value,
    set: (val: number | null) => {
        if (val === model.value) {
            return;
        }
        model.value = val;
    },
});

const stepperValue = computed({
    get: () => model.value ?? props.min ?? 0,
    set: (val: number) => {
        model.value = val;

        // todo: is this necesary?
        nextTick(() => {
            clean();
        }).catch(console.error);
    },
});

// onMounted(() => {
//     clean();
// })

watch(valueString, (value: string) => {
    // We need the value string here! Vue does some converting to numbers automatically
    // but for our placeholder system we need exactly the same string
    if (value === '') {
        if (props.required) {
            valid.value = true;
            internalValue.value = Math.max(0, props.min ?? 0);
        }
        else {
            valid.value = true;
            internalValue.value = null;
        }
    }
    else {
        if (!value.includes('.')) {
            // We do this for all locales since some browsers report the language locale instead of the formatting locale
            value = value.replace(',', '.');
        }
        const v = parseFloat(value);
        if (isNaN(v)) {
            valid.value = false;
            internalValue.value = props.min ?? 0;
        }
        else {
            valid.value = true;

            // Remove extra decimals
            internalValue.value = constrain(Math.round(v * (props.floatingPoint ? 100 : 1)));
        }
    }
});

/// Returns the decimal separator of the system. Might be wrong if the system has a region set different from the language with an unknown combination.
function whatDecimalSeparator(): string {
    const n = 1.1;
    const str = n.toLocaleString().substring(1, 2);
    return str;
}

// Restore invalid input, make the input value again
// And set valueString
function clean() {
    if (!valid.value || (model.value === null && props.required)) {
        return;
    }

    // Only update valuestring if input not focused
    // otherwise this gives glitchs when typing when minimum > 0
    const inputElement = inputEl.value;
    if (inputElement) {
        const activeElement = (('getRootNode' in inputElement ? (inputElement.getRootNode() ?? document) : document) as any).activeElement as HTMLElement;

        if (inputElement === activeElement) {
            return;
        }
    }

    let value = model.value;
    if (value === null) {
        if (!props.required) {
            valueString.value = '';
            return;
        }
        value = props.min ?? 0;
    }

    // Check if has decimals
    const float = value / (props.floatingPoint ? 100 : 1);
    const decimals = float % 1;
    const abs = Math.abs(float);

    if (decimals !== 0) {
        // Include decimals
        valueString.value
                = (float < 0 ? '-' : '')
                    + Math.floor(abs)
                    + whatDecimalSeparator()
                    + ('' + Math.round(Math.abs(decimals) * (props.floatingPoint ? 100 : 1))).padStart(2, '0');
    }
    else {
        // Hide decimals
        valueString.value = float + '';
    }
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
    if (!valid.value) {
        return;
    }
    const v = constrain((internalValue.value ?? props.min ?? 0) + add);
    internalValue.value = v;
    nextTick(() => {
        clean();
    }).catch(console.error);
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
