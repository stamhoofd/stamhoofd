import { ContextPermissions } from '@stamhoofd/networking';
import { useContext } from '#hooks/useContext';

export function useAuth(): ContextPermissions {
    const context = useContext();
    return context.value.auth;
}
