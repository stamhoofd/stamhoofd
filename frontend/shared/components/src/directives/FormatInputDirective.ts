import type { ObjectDirective } from 'vue';

export function formatInput(input: HTMLInputElement, cleaner: (value: string) => string, formatter: (value: string) => string) {
    if (input.selectionStart === null) {
        input.value = formatter(cleaner(input.value));
        return;
    }

    if (input.selectionStart !== input.selectionEnd) {
        return;
    }

    let formatted = formatter(cleaner(input.value));
    if (cleaner(formatted) !== cleaner(input.value)) {
        console.warn('[formatInput] Formatted value removed or added extra characters that are not cleaned');
        formatted = cleaner(input.value);
    }

    const before = input.value.substring(0, input.selectionStart);
    const cleanedBefore = cleaner(before);
    const cleanedSelectionStart = cleanedBefore.length;

    // Find the next selection start within the new formatted string
    let newSelectionStart = 0;
    let count = 0;

    for (let i = 0; i < formatted.length; i++) {
        const char = formatted[i];

        if (cleaner(char).length === 0) {
            continue;
        }

        count += 1;

        if (count === cleanedSelectionStart) {
            newSelectionStart = i + 1;
            break;
        }
    }

    input.value = formatted;
    input.setSelectionRange(newSelectionStart, newSelectionStart);
}

type FormatterDefinition = {
    cleaner: (value: string) => string;
    formatter: (value: string) => string;
};

export const FormatInputDirective: ObjectDirective<HTMLInputElement, FormatterDefinition> = {
    mounted(el: HTMLInputElement, binding) {
        el.addEventListener('input', () => {
            if (!binding.value) {
                return;
            }

            formatInput(el, binding.value.cleaner, binding.value.formatter);
        }, { capture: true });
    },
};
