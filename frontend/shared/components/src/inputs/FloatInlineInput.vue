<template>
    <span class="st-inline-input" :class="{ error: !isValid, disabled: disabled }" @click="focusInput">
        <span class="field">
            <span class="sizer">{{ text }}</span>
            <input
                ref="input"
                v-model="text"
                :disabled="disabled"
                :aria-label="label ?? undefined"
                type="text"
                :inputmode="fractionDigits > 0 ? 'decimal' : 'numeric'"
                step="any"
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
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef, watch } from 'vue';
import { useNumberInput } from './useNumberInput';

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

// A sentence always needs a value, so there is no empty state and no placeholder
const numberInput = useNumberInput(computed(() => ({ ...props, required: true })));
const model = defineModel<number | null>({ default: null });
const text = ref<string>(numberInput.numberToString(model.value, { valueIfNaN: '' }));
const inputElement = useTemplateRef<HTMLInputElement>('input');

const isValid = computed(() => numberInput.validateText(text.value, { valueIfNaN: null }).isValid);
const suffixText = computed(() => (model.value === numberInput.multipier.value && props.suffixSingular !== null ? props.suffixSingular : props.suffix));

// An out of range or missing value is corrected right away, so the sentence never shows a value the model does not have
updateModelValue();

watch(numberInput.multipier, () => {
    updateModelValue();
});

watch(() => model.value, (value) => {
    // do not update text while focused
    if (isInputFocused()) {
        return;
    }
    const valueAsString = numberInput.numberToString(value, { valueIfNaN: text.value });
    if (valueAsString !== text.value) {
        text.value = valueAsString;
    }
});

function focusInput() {
    if (props.disabled) {
        return;
    }
    inputElement.value?.focus();
}

function blurInput() {
    inputElement.value?.blur();
}

function onFocus() {
    if (props.selectOnFocus) {
        inputElement.value?.select();
    }
}

function setModelValue(value: number | null, { final }: { final: boolean } = { final: true }) {
    if (value !== model.value) {
        model.value = value;
    }
    if (final) {
        updateText(value);
    }
}

function updateText(value: number | null) {
    text.value = numberInput.numberToString(value, { valueIfNaN: '' });
}

function step(add: number) {
    // One step is one displayed unit, so ArrowUp on a percentage adds 1% and not 0,01%
    setModelValue(numberInput.step(model.value, add * numberInput.multipier.value));
}

function updateModelValue(options: { final: boolean } = { final: true }) {
    validate(text.value, options);
}

function validate(value: string, { final }: { final: boolean } = { final: true }) {
    const number = numberInput.stringToNumber(value, { valueIfNaN: null });

    if (final) {
        // constrain falls back to the minimum for a missing value, so the model never becomes
        // null: a patch cannot set null as a value on the structure.
        setModelValue(numberInput.constrain(number));
        return;
    }

    const { isValid } = numberInput.validateNumber(number);
    if (isValid) {
        setModelValue(number, { final });
    }
}

function isInputFocused(): boolean {
    if (!inputElement.value) {
        return false;
    }
    const inputEl = inputElement.value;
    const activeElement = (('getRootNode' in inputEl ? (inputEl.getRootNode() ?? document) : document) as any).activeElement as HTMLElement;
    return activeElement === inputEl;
}
</script>
