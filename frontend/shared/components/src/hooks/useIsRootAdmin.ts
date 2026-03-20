import { useContext } from './useContext';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { Ref } from 'vue';
import { computed } from 'vue';

function checkRootAdmin(context: SessionContext): boolean {
    if (context.user && context.user.email.endsWith('@stamhoofd.be') && context.auth.hasPlatformFullAccess()) {
        return true;
    }
    return false;
}

export function useIsRootAdmin(): Ref<boolean> {
    const context = useContext();

    return computed(() => {
        return checkRootAdmin(context.value);
    });
}
