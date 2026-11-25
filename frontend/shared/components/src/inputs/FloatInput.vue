<template>
    <div class="float-input input" :class="{ error: !isValid, disabled }">
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
                    v-model="text"
                    type="text"
                    inputmode="decimal"
                    :disabled="disabled"
                    @keydown.up.prevent="step(1)"
                    @keydown.down.prevent="step(-1)"
                    @change="updateModelValue()"
                    @input="updateModelValue({ final: false })"
                >
                <div v-if="!text.length" class="placeholder">
                    {{ placeholder }}
                </div>
                <div v-else>
                    <span>{{ text }}</span> {{ suffix }}
                </div>
            </div>

            <div class="right">
                <slot name="right" />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed, useTemplateRef } from 'vue';
import { useNumberInputText } from './useNumberInput';

const props = withDefaults(defineProps<{
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
    autoFix?: boolean;
}>(), {
    min: null,
    max: null,
    placeholder: '',
    suffix: '',
    disabled: false,
    required: true,
    fractionDigits: 2,
    roundFractionDigits: null,
    autoFix: true,
});

const model = defineModel<number | null>({ default: null });
const inputElement = useTemplateRef<HTMLInputElement>('input');
const { text, isValid, multipier, stepModelValue, updateModelValue } = useNumberInputText(computed(() => props), model, inputElement);

function step(add: number) {
    // One step is one displayed unit, so ArrowUp on a price adds 1 euro and not 1 cent
    stepModelValue(add * multipier.value);
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.float-input {
    position: relative;

    // Clear any padding or margin
    padding: 0 !important;

    .clear {
        position: relative;
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        min-width: 100px;

        > .left {
            position: relative;
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
            height: $input-height; // In case the input is empty, need to maintain the height with the absolute positioned input

            & > div {
                pointer-events: none;
                user-select: none;
                white-space: nowrap;
                padding: 5px 15px;

                span {
                    white-space: pre;
                }

                &.placeholder {
                    color: $color-gray-5;
                    opacity: 1;
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

        > .right {
            padding: 5px 15px;
            text-align: right;

            &:empty {
                display: none;
            }
        }
    }
}
</style>
