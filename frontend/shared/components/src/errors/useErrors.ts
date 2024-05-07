import { Ref, ref } from "vue";
import { ErrorBox } from "./ErrorBox";
import { Validator } from "./Validator";

export function useErrors() {
    return {
        errorBox: ref(null) as Ref<ErrorBox | null>,
        validator: new Validator()
    }
}