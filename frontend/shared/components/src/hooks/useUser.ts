import type { UserWithMembers } from '@stamhoofd/structures';
import type { Ref} from 'vue';
import { computed } from 'vue';
import { useContext } from './useContext';

/** During setup, read the context's current user as a computed ref; null when no user is loaded. */
export function useUser(): Ref<UserWithMembers | null> {
    const context = useContext()
    return computed(() => context.value.user);
}
