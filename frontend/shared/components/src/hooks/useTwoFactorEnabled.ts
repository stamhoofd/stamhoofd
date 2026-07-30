import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { Organization, Platform } from '@stamhoofd/structures';
import type { ComputedRef } from 'vue';
import { computed } from 'vue';
import { useContext } from './useContext';
import { manualFeatureFlag } from './useFeatureFlag';
import { useOrganization } from './useOrganization';
import { usePlatform } from './usePlatform';

/**
 * Whether the current user may set up two-factor authentication.
 *
 * The 'mfa' flag enables the setup flow for everyone. When it is disabled, 'mfa-admins'
 * still enables it for users with platform permissions, so it can be rolled out to the
 * platform's own admins first.
 *
 * Note that this only hides the setup flow: whether 2FA is *required* is decided by the
 * backend (Platform.privateConfig.requireTwoFactor and
 * Organization.privateMeta.requireTwoFactor), so a forced enrollment is never blocked by
 * these flags.
 */
export function isTwoFactorEnabled(context: SessionContext, platform: Platform, organization?: Organization | null): boolean {
    if (manualFeatureFlag('mfa', context, platform, organization)) {
        return true;
    }

    return manualFeatureFlag('mfa-admins', context, platform, organization)
        && context.auth.hasSomePlatformAccess();
}

export function useTwoFactorEnabled(): ComputedRef<boolean> {
    const context = useContext();
    const organization = useOrganization();
    const platform = usePlatform();

    return computed(() => isTwoFactorEnabled(context.value, platform.value, organization.value));
}
