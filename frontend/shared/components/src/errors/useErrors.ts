import { reactive } from "vue";

import { ErrorBox } from "./ErrorBox";
import { Validator } from "./Validator";

export function useErrors() {
    return reactive({
        errorBox: null as ErrorBox | null,
        validator: new Validator()
    })
}
