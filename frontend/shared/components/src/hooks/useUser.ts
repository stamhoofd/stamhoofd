import type { UserWithMembers } from '@stamhoofd/structures';
import type { Ref} from 'vue';
import { computed } from 'vue';
import { useContext } from './useContext';

export function useUser(): Ref<UserWithMembers | null> {
    const context = useContext()
    return computed(() => context.value.user);
}
