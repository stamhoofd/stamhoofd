import type {SessionContext} from '@stamhoofd/networking/SessionContext';
import type { Ref} from 'vue';
import { inject, toRef } from 'vue';

/** Inject the session context during setup; requires an ancestor providing `$context` (no runtime missing-context guard). */
export function useContext(): Ref<SessionContext> {
    const refOrReal = inject('$context', null) as SessionContext | null;
    return toRef(refOrReal) as any as Ref<SessionContext>;
}
