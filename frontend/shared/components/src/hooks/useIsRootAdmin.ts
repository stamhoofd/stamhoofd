import { useContext } from './useContext';
import { SessionContext } from '@stamhoofd/networking';
import { computed, Ref } from 'vue';

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
