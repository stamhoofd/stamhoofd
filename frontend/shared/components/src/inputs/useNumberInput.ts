import type { ComputedRef } from 'vue';
import { unref } from 'vue';

type UseNumberInputOptions = { required: boolean; min: number | null; max: number | null; floatingPoint: boolean };

export function useNumberInput(options: ComputedRef<UseNumberInputOptions> | UseNumberInputOptions) {
    const getOptions = () => unref(options);

    const validateText = (value: string, { valueIfNaN }: { valueIfNaN: number | null }): { isValid: boolean; value: number | null } => {
        const { required, floatingPoint } = getOptions();

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

        const corrected = Math.round(parsed * (floatingPoint ? 100 : 1));
        const constrainedResult = constrain(corrected);
        const isValid = constrainedResult === corrected;

        return {
            isValid,
            value: corrected,
        };
    };

    const validateNumber = (value: number | null): { isValid: false; errorMessage: string } | { isValid: true } => {
        const { required } = getOptions();

        if (value === null) {
            if (required) {
                return {
                    isValid: false,
                    errorMessage: $t(`%qt`),
                };
            }

            return {
                isValid: true,
            };
        }

        if (isNaN(value)) {
            return {
                isValid: false,
                errorMessage: addOptionalTextToErrorMessage($t(`Vul een geldig getal in`), required),
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

        const optionalText = $t(`. Dit veld is optioneel.`);
        return errorMessage + optionalText;
    }

    const validateConstraints = (value: number): { isValid: false; errorMessage: string; value: number } | { isValid: true; value: number } => {
        const { min, max, required } = getOptions();

        if (min !== null && value < min) {
            return {
                isValid: false,
                errorMessage: addOptionalTextToErrorMessage($t(`Het minimum is {min}`, { min: min }), required),
                value: min,
            };
        }

        if (max !== null && value > max) {
            return {
                isValid: false,
                errorMessage: addOptionalTextToErrorMessage($t(`Het maximum is {max}`, { max: max }), required),
                value: max,
            };
        }

        return {
            isValid: true,
            value,
        };
    };

    const constrain = (value: number | null): number | null => {
        const { min, max, required } = getOptions();

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
        const { floatingPoint } = getOptions();

        if (value === null) {
            return '';
        }

        if (isNaN(value)) {
            return valueIfNaN;
        }

        // Check if has decimals
        const float = value / (floatingPoint ? 100 : 1);
        const decimals = float % 1;
        const abs = Math.abs(float);

        if (decimals !== 0) {
            // include decimals
            return (float < 0 ? '-' : '')
                + Math.floor(abs)
                + getDecimalSeparator()
                + ('' + Math.round(Math.abs(decimals) * (floatingPoint ? 100 : 1))).padStart(2, '0');
        }

        // Hide decimals
        return float + '';
    };

    const stringToNumber = (value: string, { valueIfNaN }: { valueIfNaN: number | null }): number | null => {
        const { floatingPoint } = getOptions();

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

        return Math.round(parsed * (floatingPoint ? 100 : 1));
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
    };
}
