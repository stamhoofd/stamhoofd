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
     * Correct an invalid or out of range value when the input loses focus.
     */
    autoFix?: boolean;

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
    autoFix: true,
    selectOnFocus: true,
    label: null,
});

// A sentence always needs a value, so there is no empty state and no placeholder
const numberInput = useNumberInput(computed(() => ({ ...props, required: true })));
const model = defineModel<number | null>({ default: null });
const text = ref<string>(numberInput.numberToString(model.value, { valueIfNaN: '' }));
const inputElement = useTemplateRef<HTMLInputElement>('input');

const isValid = computed(() => props.autoFix ? numberInput.validateText(text.value, { valueIfNaN: null }).isValid : true);
const suffixText = computed(() => (model.value === numberInput.multipier.value && props.suffixSingular !== null ? props.suffixSingular : props.suffix));

if (props.autoFix) {
    updateModelValue();
}

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
        return;
    }
    else if (final) {
        updateText(value);
    }
}

function updateText(value: number | null) {
    text.value = numberInput.numberToString(value, {
        valueIfNaN: props.autoFix ? '' : text.value,
    });
}

function step(add: number) {
    const newValue = numberInput.step(model.value, add);
    setModelValue(newValue);

    // necessary because input is in focus
    updateText(newValue);
}

function updateModelValue(options: { final: boolean } = { final: true }) {
    validate(text.value, options);
}

function validate(value: string, { final }: { final: boolean } = { final: true }) {
    let number = numberInput.stringToNumber(value, { valueIfNaN: props.autoFix ? null : NaN });

    if (final) {
        if (props.autoFix) {
            number = numberInput.constrain(number);
        }
        // The model value should never be null because a patch will not be able to set null as a value on the structure.
        else if (number === null) {
            number = props.min ?? 0;
        }

        setModelValue(number);
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
