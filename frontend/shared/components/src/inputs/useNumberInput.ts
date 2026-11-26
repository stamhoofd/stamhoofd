import { Formatter } from '@stamhoofd/utility';
import type { ComputedRef, Ref, ShallowRef } from 'vue';
import { computed, ref, watch } from 'vue';

type UseNumberInputOptions = { required: boolean; min: number | null; max: number | null; suffix?: string | null; suffixSingular?: string | null; fractionDigits: number; roundFractionDigits: number | null };

type UseNumberInputTextOptions = UseNumberInputOptions & { autoFix: boolean };

export function useNumberInput(options: ComputedRef<UseNumberInputOptions>) {
    const multipier = computed(() => Math.pow(10, options.value.fractionDigits));

    const roundFractions = (v: number) => {
        const { roundFractionDigits, fractionDigits } = options.value;

        if (roundFractionDigits === null) {
            return v;
        }

        if (roundFractionDigits >= fractionDigits) {
            return v;
        }

        const multiplyAmount = fractionDigits - roundFractionDigits;
        const roundMultiplier = Math.pow(10, multiplyAmount);

        return Math.round(v / roundMultiplier) * roundMultiplier;
    };

    const validateText = (value: string, { valueIfNaN }: { valueIfNaN: number | null }): { isValid: boolean; value: number | null } => {
        const { required } = options.value;

        if (!value.length) {
            if (required) {
                return {
                    isValid: false,
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
                value: valueIfNaN,
            };
        }

        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
            return {
                isValid: false,
                value: valueIfNaN,
            };
        }

        const corrected = roundFractions(Math.round(parsed * multipier.value));
        const constrainedResult = constrain(corrected);
        const isValid = constrainedResult === corrected;

        return {
            isValid,
            value: corrected,
        };
    };

    const validateNumber = (value: number | null): { isValid: false; errorMessage: string } | { isValid: true } => {
        const { required } = options.value;

        if (value === null) {
            if (required) {
                return {
                    isValid: false,
                    errorMessage: $t('%qt'),
                };
            }

            return {
                isValid: true,
            };
        }

        if (isNaN(value)) {
            return {
                isValid: false,
                errorMessage: addOptionalTextToErrorMessage($t('%1Nv'), required),
            };
        }

        const constrainedResult = validateConstraints(value);

        if (!constrainedResult.isValid) {
            return {
                isValid: false,
                errorMessage: constrainedResult.errorMessage,
            };
        }

        return {
            isValid: true,
        };
    };

    function addOptionalTextToErrorMessage(errorMessage: string, required: boolean): string {
        if (required) {
            return errorMessage;
        }

        const optionalText = $t('%1Nk');
        return errorMessage + optionalText;
    }

    const formatValue = (value: number) => {
        // Use all fraction digits so a min/max bound is never displayed rounded in error messages
        const float = value / multipier.value;
        const suffix = (float === 1 ? options.value.suffixSingular : null) ?? options.value.suffix;
        return Formatter.float(float, { maximumFractionDigits: options.value.fractionDigits }) + (suffix ? ' ' + suffix : '');
    };

    const validateConstraints = (value: number): { isValid: false; errorMessage: string; value: number } | { isValid: true; value: number } => {
        const { min, max, required } = options.value;

        if (min !== null && value < min) {
            return {
                isValid: false,
                errorMessage: addOptionalTextToErrorMessage($t('%1OG', { min: formatValue(min) }), required),
                value: min,
            };
        }

        if (max !== null && value > max) {
            return {
                isValid: false,
                errorMessage: addOptionalTextToErrorMessage($t('%1Oy', { max: formatValue(max) }), required),
                value: max,
            };
        }

        return {
            isValid: true,
            value,
        };
    };

    const constrain = (value: number | null): number | null => {
        const { min, max, required } = options.value;

        if (value === null) {
            if (required) {
                return min ?? 0;
            }
            return null;
        }

        if (min !== null && value < min) {
            return min;
        }

        if (max !== null && value > max) {
            return max;
        }

        return value;
    };

    const numberToString = (value: number | null, { valueIfNaN }: { valueIfNaN: string }) => {
        const { fractionDigits } = options.value;

        if (value === null) {
            return '';
        }

        if (isNaN(value)) {
            return valueIfNaN;
        }

        // Check if has decimals
        const float = value / multipier.value;
        const decimals = float % 1;
        const abs = Math.abs(float);

        if (decimals !== 0) {
            const fractions = Math.round(Math.abs(decimals) * multipier.value);

            // Trim trailing zeros up until roundFractionDigits
            if (fractions % 100 === 0) {
                return (float < 0 ? '-' : '')
                    + Math.floor(abs)
                    + getDecimalSeparator()
                    + ('' + fractions / 100).padStart(fractionDigits - 2, '0');
            }

            if (fractions % 10 === 0) {
                return (float < 0 ? '-' : '')
                    + Math.floor(abs)
                    + getDecimalSeparator()
                    + ('' + fractions / 10).padStart(fractionDigits - 1, '0');
            }

            return (float < 0 ? '-' : '')
                + Math.floor(abs)
                + getDecimalSeparator()
                + ('' + fractions).padStart(fractionDigits, '0');
        }

        // Hide decimals
        return float + '';
    };

    const stringToNumber = (value: string, { valueIfNaN }: { valueIfNaN: number | null }): number | null => {
        if (!value.length) {
            return null;
        }

        if (!value.includes('.')) {
        // We do this for all locales since some browsers report the language locale instead of the formatting locale
            value = value.replace(',', '.');
        }

        // todo: check whether this is necessary
        if (isNaN(parseInt(value))) {
            return valueIfNaN;
        }

        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
            return valueIfNaN;
        }

        return roundFractions(Math.round(parsed * multipier.value));
    };

    const step = (value: number | null, add: number): number => {
        const { min, max } = options.value;

        if (value === null || isNaN(value)) {
            return min ?? 0;
        }

        const newValue = value + add;

        if (min !== null && newValue < min) {
            return min;
        }

        if (max !== null && newValue > max) {
            return max;
        }

        return newValue;
    };

    /**
     * Returns the decimal separator of the system. Might be wrong if the system has a region set different from the language with an unknown combination.
     */
    const getDecimalSeparator = (): string => {
        const n = 1.1;
        const str = n.toLocaleString().substring(1, 2);
        return str;
    };

    return {
        validateText,
        validateNumber,
        constrain,
        numberToString,
        stringToNumber,
        step,
        multipier,
    };
}

/**
 * Binds the text of an input element to a number model: the two cannot be the same value because
 * the string that is being typed is not always a number the model can hold.
 */
export function useNumberInputText(options: ComputedRef<UseNumberInputTextOptions>, model: Ref<number | null>, inputElement: Readonly<ShallowRef<HTMLInputElement | null>>) {
    const numberInput = useNumberInput(options);
    const text = ref<string>(numberInput.numberToString(model.value, { valueIfNaN: '' }));
    const isValid = computed(() => options.value.autoFix ? numberInput.validateText(text.value, { valueIfNaN: null }).isValid : true);

    if (options.value.autoFix) {
        // An out of range or missing value is corrected right away, so the text never shows a value the model does not have
        updateModelValue();
    }

    // The multiplier changes what the same text means, so the model has to be derived from it again
    watch(numberInput.multipier, () => {
        updateModelValue();
    });

    watch(model, (value) => {
        // do not update text while focused
        if (isInputFocused()) {
            return;
        }
        const valueAsString = numberInput.numberToString(value, { valueIfNaN: text.value });
        if (valueAsString !== text.value) {
            text.value = valueAsString;
        }
    });

    function setModelValue(value: number | null, { final }: { final: boolean } = { final: true }) {
        if (value !== model.value) {
            model.value = value;
        }
        if (final) {
            updateText(value);
        }
    }

    function updateText(value: number | null) {
        text.value = numberInput.numberToString(value, { valueIfNaN:
            options.value.autoFix ? '' : text.value,
        });
    }

    function stepModelValue(add: number) {
        setModelValue(numberInput.step(model.value, add));
    }

    function updateModelValue({ final }: { final: boolean } = { final: true }) {
        let number = numberInput.stringToNumber(text.value, { valueIfNaN: options.value.autoFix ? null : NaN });

        if (final) {
            if (options.value.autoFix) {
                number = numberInput.constrain(number);
            } else if (options.value.required && number === null) {
                // If required the model value should never be null because a patch will not be able to set null as a value on the structure.
                number = options.value.min ?? 0;
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

    return {
        ...numberInput,
        text,
        isValid,
        stepModelValue,
        updateModelValue,
    };
}
