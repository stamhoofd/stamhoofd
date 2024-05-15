import { reactive } from "vue";

import { ErrorBox } from "./ErrorBox";
import { Validator } from "./Validator";

export function useErrors(options?: {validator?: Validator|null}) {
    return reactive({
        errorBox: null as ErrorBox | null,
        validator: options?.validator ?? new Validator()
    })
}
