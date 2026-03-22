import { onBeforeUnmount } from 'vue';
import type { Validation, Validator } from './Validator';

export function useValidation(validator: Validator, validation: Validation, key?: string) {
    const owner = {};
    validator.addValidation(owner, validation, key);

    onBeforeUnmount(() => {
        validator.removeValidation(owner);
    });
}
