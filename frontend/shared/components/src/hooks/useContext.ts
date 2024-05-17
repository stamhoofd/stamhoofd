import { SessionContext } from "@stamhoofd/networking";
import { inject, Ref, toRef } from "vue";

export function useContext(): Ref<SessionContext> {
    const refOrReal = inject('$context', null) as SessionContext|null;
    return toRef(refOrReal) as Ref<SessionContext>
}
