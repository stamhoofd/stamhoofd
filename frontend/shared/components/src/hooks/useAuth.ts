import { useContext } from '#hooks/useContext.ts';
import { ContextPermissions } from '@stamhoofd/networking/ContextPermissions';
import type { Organization } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { usePlatform } from './usePlatform';
import { useUser } from './useUser';

/**
 * Read the current context's permission checker during component setup.
 * Methods return plain values, not refs; wrap a check in `computed` when the UI
 * must track its reactive inputs. UI gating does not replace backend authorization.
 */
export function useAuth(): ContextPermissions {
    const context = useContext();
    return context.value.auth;
}

/** Create a checker scoped to an organization, using the current user and platform. */
export function useScopedAuth(organization: Organization | Ref<Organization | null>): ContextPermissions {
    const user = useUser();
    const platform = usePlatform();

    return new ContextPermissions(user, organization, platform);
}
