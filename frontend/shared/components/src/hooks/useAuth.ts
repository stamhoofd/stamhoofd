import { useContext } from '#hooks/useContext.ts';
import { ContextPermissions } from '@stamhoofd/networking/ContextPermissions';
import type { Organization } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { usePlatform } from './usePlatform';
import { useUser } from './useUser';

export function useAuth(): ContextPermissions {
    const context = useContext();
    return context.value.auth;
}

export function useScopedAuth(organization: Organization | Ref<Organization | null>): ContextPermissions {
    const user = useUser();
    const platform = usePlatform();

    return new ContextPermissions(user, organization, platform);
}
