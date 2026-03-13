import { ContextPermissions } from '@stamhoofd/networking/ContextPermissions';
import { useContext } from '#hooks/useContext.ts';

export function useAuth(): ContextPermissions {
    const context = useContext();
    return context.value.auth;
}
