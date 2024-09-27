import { onBeforeUnmount } from 'vue';
import { Validation, Validator } from './Validator';

export function useValidation(validator: Validator, validation: Validation, key?: string) {
    const owner = {};
    validator.addValidation(owner, validation, key);

    onBeforeUnmount(() => {
        validator.removeValidation(owner);
    });
}
