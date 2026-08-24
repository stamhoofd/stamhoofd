import { usePresent } from '@simonbackx/vue-app-navigation';
import type { User } from '@stamhoofd/structures';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useFeatureFlag } from '#hooks/useFeatureFlag.ts';
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
    const me = useUser();
    const hasFeatureFlag = useFeatureFlag();

    function canImpersonate(user: User): boolean {
        if (!hasFeatureFlag('impersonation')) {
            return false;
        }

        if (user.id === me.value?.id) {
            return false;
        }

        // Only full platform admins can impersonate a user with platform access
        if (user.permissions?.globalPermissions && !user.permissions.globalPermissions.isEmpty && !auth.hasPlatformFullAccess()) {
            return false;
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
