<template>
    <label class="float-input input" :class="{ error: !valid, disabled }">
        <div class="clear">
            <div class="left">
                <!--
                    We use type = text here because the specs of number inputs ensure that we can't get
                    the raw string modelValue, but we need this for our placeholder logic.
                    Also inputmode is more specific on mobile devices.
                    Only downside is that we lose the stepper input on desktop.
                -->
                <input
                    ref="input"
                    v-model="valueString"
                    type="text"
                    inputmode="decimal"
                    step="any"
                    :disabled="disabled"
                    @blur="clean"
                    @keydown.up.prevent="step(100)"
                    @keydown.down.prevent="step(-100)"
                >
                <div v-if="!valid">
                    <span>{{ valueString }}</span>
                </div>
                <div v-else-if="valueString !== ''">
                    <span>{{ valueString }}</span> {{ suffix }}
                </div>
                <div v-else class="placeholder">{{ placeholder }}</div>
            </div>

            <div class="right">
                <slot name="right" />
            </div>
        </div>
    </label>
</template>

<script lang="ts" setup>
import { nextTick, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
    min?: number | null;
    max?: number | null;
    placeholder?: string;
    suffix?: string;
    disabled?: boolean;
    required?: boolean;
}>(), {
    min: null,
    max: null,
    placeholder: '',
    suffix: '',
    disabled: false,
    required: true,
});

const model = defineModel<number | null>('modelValue', {
    required: true,
});

const valueString = ref('');
const valid = ref(true);

watch(model, (newValue, oldValue) => {
    const { value: currentValue, valid: wasValid } = stringToValue(valueString.value);

    if (currentValue === newValue && wasValid) {
        return;
    }

    if (newValue === null) {
        if (props.required) {
            model.value = constrain(props.min ?? 0);
        }
        clean();
        return;
    }

    model.value = constrain(newValue);
    clean();
}, { immediate: true });

watch(valueString, (value) => {
    const { valid: v, value: newValue } = stringToValue(value);
    valid.value = v;
    model.value = newValue;
}, { immediate: false });

function stringToValue(str: string) {
    // We need the modelValue string here! Vue does some converting to numbers automatically
    // but for our placeholder system we need exactly the same string
    if (str === '') {
        if (props.required) {
            return {
                value: Math.max(0, props.min ?? 0),
                valid: false,
            };
        }
        else {
            return {
                value: null,
                valid: true,
            };
        }
    }
    else {
        if (!str.includes('.')) {
            // We do this for all locales since some browsers report the language locale instead of the formatting locale
            str = str.replace(',', '.');
        }
        const v = parseFloat(str);
        if (isNaN(v)) {
            return {
                value: props.min ?? 0,
                valid: false,
            };
        }
        else {
            // Remove extra decimals
            return {
                value: constrain(Math.round(v * 100)),
                valid: true,
            };
        }
    }
}

/// Returns the decimal separator of the system. Might be wrong if the system has a region set different from the language with an unknown combination.
function whatDecimalSeparator(): string {
    const n = 1.1;
    const str = n.toLocaleString().substring(1, 2);
    return str;
}

// Restore invalid input, make the input value again
// And set valueString
function clean() {
    if (!valid.value) {
        return;
    }

    const value = model.value;

    if (value === null) {
        valueString.value = '';
        return;
    }

    // Check if has decimals
    const float = value / 100;
    const decimals = float % 1;
    const abs = Math.abs(float);

    if (decimals !== 0) {
        // Include decimals
        valueString.value
            = (float < 0 ? '-' : '')
            + Math.floor(abs)
            + whatDecimalSeparator()
            + ('' + Math.round(Math.abs(decimals) * 100)).padStart(2, '0');
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
    model.value = constrain((model.value ?? props.min ?? 0) + add);
    nextTick(() => {
        clean();
    }).catch(console.error);
}

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.float-input {
    position: relative;

    .clear {
        // Clear any padding or margin
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;

        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
    }

    .left {
        & > div {
            pointer-events: none;
            user-select: none;
            white-space: nowrap;
            padding: 5px 15px;

            span {
                white-space: pre;
            }

            &.placeholder {
                opacity: 0.5;
            }
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

    .right {
        padding: 5px 15px;

        &:empty {
            display: none;
        }
    }
}
</style>
