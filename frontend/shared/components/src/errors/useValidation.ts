import { onBeforeUnmount } from "vue";
import { Validation, Validator } from "./Validator";

export function useValidation(validator: Validator, validation: Validation) {
    const owner = {};
    validator.addValidation(owner, validation);

    onBeforeUnmount(() => {
        validator.removeValidation(owner);
    })
}
