<template>
    <label class="age-input input" :class="{ error: !valid }">
        <!--
            We use type = text here because the specs of number inputs ensure that we can't get
            the raw string value, but we need this for our placeholder logic.
            Also inputmode is more specific on mobile devices.
            Only downside is that we lose the stepper input on desktop.
        -->
        <input
            ref="input"
            v-model="valueString"
            type="text"
            inputmode="numeric"
            step="any"
            @blur="clean"
            @keydown.up.prevent="step(1)"
            @keydown.down.prevent="step(-1)"
        >
        <div v-if="!valid">
            <span>{{ valueString }}</span>
        </div>
        <div v-else-if="valueString !== ''">
            <span>{{ valueString }}</span> {{ descriptionText }}
        </div>
        <div v-else>{{ placeholder }}</div>
    </label>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

const model = defineModel<number | null>({ default: null });

const props = withDefaults(defineProps<{
    min?: number;
    nullable?: boolean;
    max?: number | null;
    year?: number | null;
    placeholder?: string;
}>(), {
    min: 0,
    nullable: false,
    max: 99,
    year: null,
    placeholder: '',
});

const valueString = ref('');
const valid = ref(true);

const internalValue = model;

const descriptionText = computed(() => {
    if (!model.value) {
        return '';
    }
    return $t(`%yp`) + ' ' + ((props.year ?? new Date().getFullYear()) - model.value) + ')';
});

onMounted(() => {
    clean();
});

watch(valueString, (value: string) => {
    // We need the value string here! Vue does some converting to numbers automatically
    // but for our placeholder system we need exactly the same string
    if (value === '') {
        valid.value = true;
        if (props.nullable) {
            internalValue.value = null;
        }
        else {
            internalValue.value = Math.max(0, props.min);
        }
    }
    else {
        const v = parseInt(value);
        if (isNaN(v)) {
            valid.value = false;

            if (props.nullable) {
                internalValue.value = null;
            }
            else {
                internalValue.value = props.min;
            }
        }
        else {
            valid.value = true;

            // Remove extra decimals
            internalValue.value = constrain(v);
        }
    }
});

// Restore invalid input, make the input value again
// And set valueString
function clean() {
    if (!valid.value) {
        return;
    }
    if (internalValue.value === null) {
        valueString.value = '';
        return;
    }
    // Check if has decimals
    valueString.value = Math.floor(internalValue.value) + '';
}

// Limit value to bounds
function constrain(value: number): number {
    value = Math.max(props.min, value);
    if (props.max !== null && value > props.max) {
        value = props.max;
    }
    return value;
}

function step(add: number) {
    if (!valid.value) {
        return;
    }
    if (internalValue.value === null) {
        return;
    }
    const val = constrain(internalValue.value + add);
    valueString.value = Math.floor(val) + '';
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.age-input {
    position: relative;

    & > div {
        pointer-events: none;
        user-select: none;
        white-space: nowrap;

        span {
            white-space: pre;
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
</style>
