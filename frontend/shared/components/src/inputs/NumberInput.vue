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
                ref="input"
                v-model="text"
                :disabled="disabled"
                type="text"
                :inputmode="floatingPoint ? 'decimal' : 'numeric'"
                @keydown.up.prevent="stepModelValue(1)"
                @keydown.down.prevent="stepModelValue(-1)"
                @change="updateModelValue()"
                @input="updateModelValue({ final: false })"
            >
            <div v-if="!text.length" class="placeholder">
                {{ placeholder }}
            </div>
            <div v-else>
                <span>{{ text }}</span> {{ modelValue === 1 && suffixSingular !== null ? suffixSingular : suffix }}
            </div>
        </label>
        <StepperInput v-if="stepper" v-model="stepperValue" :min="min" :max="max" />
    </div>
</template>

<script lang="ts" setup>
import { computed, useTemplateRef } from 'vue';
import StepperInput from './StepperInput.vue';
import { useNumberInputText } from './useNumberInput';

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
    // todo: naming + description
    autoFix?: boolean;
}>(), {
    title: undefined,
    class: null,
    min: null,
    max: null,
    stepper: false,
    required: true,
    disabled: false,
    suffix: '',
    suffixSingular: null,
    placeholder: '',
    floatingPoint: false,
    autoFix: true,
});

const model = defineModel<number | null>({ default: null });
const inputElement = useTemplateRef<HTMLInputElement>('input');
const { text, isValid, stepModelValue, updateModelValue } = useNumberInputText(computed(() => ({ ...props, fractionDigits: props.floatingPoint ? 2 : 0, roundFractionDigits: null })), model, inputElement);

const stepperValue = computed({
    get: () => {
        const value = model.value;
        if (value === null || isNaN(value)) {
            return props.min ?? 0;
        }
        return value;
    },
    set: (value: number) => {
        model.value = value;
    },
});
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
