<template>
    <span class="st-inline-input" :class="{ error: !isValid, disabled: disabled }" @click="focusInput">
        <span class="content">
            <span class="field">
                <span class="sizer">{{ text || lastCharacter }}</span>
                <input
                    ref="input"
                    v-model="text"
                    :disabled="disabled"
                    :aria-label="label ?? undefined"
                    type="text"
                    :inputmode="fractionDigits > 0 ? 'decimal' : 'numeric'"
                    @focus="onFocus"
                    @keydown.up.prevent="step(1)"
                    @keydown.down.prevent="step(-1)"
                    @keydown.enter.prevent="blurInput"
                    @change="updateModelValue()"
                    @input="updateModelValue({ final: false })"
                >
            </span>
            <span v-if="suffixText" class="affix">{{ suffixText }}</span>
        </span>
    </span>
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef, watch } from 'vue';
import { useNumberInputText } from './useNumberInput';

const props = withDefaults(defineProps<{
    min?: number | null;
    max?: number | null;
    disabled?: boolean;
    suffix?: string;
    suffixSingular?: string | null;

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

    /**
     * Select the value when the input gets focus, so typing replaces it.
     */
    selectOnFocus?: boolean;

    /**
     * Describes the value for screen readers, since an inline input has no visible title.
     */
    label?: string | null;
}>(), {
    min: null,
    max: null,
    disabled: false,
    suffix: '',
    suffixSingular: null,
    fractionDigits: 0,
    roundFractionDigits: null,
    selectOnFocus: true,
    label: null,
});

const model = defineModel<number | null>({ default: null });
const inputElement = useTemplateRef<HTMLInputElement>('input');

// A sentence always needs a value, so there is no empty state and no placeholder
const { text, isValid, multipier, stepModelValue, updateModelValue } = useNumberInputText(computed(() => ({ ...props, required: true, autoFix: true })), model, inputElement);

/**
 * While the input is empty there is nothing to measure, so the field keeps the width of the character
 * that was removed last: the caret stays visible and the line under the value does not collapse.
 */
const lastCharacter = ref<string>(text.value.slice(-1) || '0');

watch(text, (value, previous) => {
    if (value === '' && previous !== '') {
        lastCharacter.value = previous.slice(-1);
    }
});

const suffixText = computed(() => (model.value === multipier.value && props.suffixSingular !== null ? props.suffixSingular : props.suffix));

function focusInput() {
    if (props.disabled) {
        return;
    }
    inputElement.value?.focus();
}

defineExpose({ focus: focusInput });

function blurInput() {
    inputElement.value?.blur();
}

function onFocus() {
    if (props.selectOnFocus) {
        inputElement.value?.select();
    }
}

function step(add: number) {
    // One step is one displayed unit, so ArrowUp on a percentage adds 1% and not 0,01%
    stepModelValue(add * multipier.value);
}
</script>
