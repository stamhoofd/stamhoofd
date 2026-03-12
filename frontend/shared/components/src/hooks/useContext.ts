import { type SessionContext } from '@stamhoofd/networking/SessionContext';
import { inject, Ref, toRef } from 'vue';

export function useContext(): Ref<SessionContext> {
    const refOrReal = inject('$context', null) as SessionContext | null;
    return toRef(refOrReal) as any as Ref<SessionContext>;
}
