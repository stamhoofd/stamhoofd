import type {SessionContext} from '@stamhoofd/networking/SessionContext';
import type { Ref} from 'vue';
import { inject, toRef } from 'vue';

export function useContext(): Ref<SessionContext> {
    const refOrReal = inject('$context', null) as SessionContext | null;
    return toRef(refOrReal) as any as Ref<SessionContext>;
}
