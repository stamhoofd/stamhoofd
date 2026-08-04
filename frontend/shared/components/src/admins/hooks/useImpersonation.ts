import { usePresent } from '@simonbackx/vue-app-navigation';
import type { User } from '@stamhoofd/structures';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { useUser } from '#hooks/useUser.ts';

/**
 * Signing in as one of your users to see what they see.
 *
 * The link this hands out is what actually starts the impersonation, and the server checks
 * the permissions again when it is created and when it is used. What is decided here is
 * only whether the option is worth showing - it mirrors the server's rules closely enough
 * that the button does not appear for something that would be refused.
 */
export function useImpersonation() {
    const present = usePresent();
    const auth = useAuth();
    const organization = useOrganization();
    const me = useUser();

    function canImpersonate(user: User): boolean {
        if (!user.hasAccount || user.id === me.value?.id) {
            return false;
        }

        // Impersonating an account shows its permissions, so an administrator may only step
        // into an account that cannot do more than they can themselves.
        if (user.permissions?.globalPermissions && !user.permissions.globalPermissions.isEmpty && !auth.hasPlatformFullAccess()) {
            return false;
        }

        for (const [organizationId, permissions] of user.permissions?.organizationPermissions ?? []) {
            if (permissions.isEmpty) {
                continue;
            }
            if (organizationId !== organization.value?.id || !auth.hasFullAccess()) {
                return false;
            }
        }

        return auth.hasFullAccess() || auth.hasPlatformFullAccess();
    }

    async function impersonate(user: User) {
        await present({
            components: [
                AsyncComponent(() => import('#admins/ImpersonationLinkView.vue'), {
                    user,
                }),
            ],
            modalDisplayStyle: 'sheet',
        });
    }

    return { canImpersonate, impersonate };
}
