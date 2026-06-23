import { useOrganization } from '#hooks/useOrganization.ts';
import { computed } from 'vue';

/**
 * Whether internal administrators (members with responsibilities/functions) are relevant.
 * When disabled, we hide the functions/internal admins UI and rename 'externe beheerdersrollen' to 'beheerdersrollen'.
 *
 * See Organization.showInternalAdmins for the underlying logic.
 */
export function useShowInternalAdmins() {
    const organization = useOrganization();

    return computed(() => {
        // Without an organization, internal admins are only relevant in platform mode.
        return organization.value ? organization.value.showInternalAdmins : STAMHOOFD.userMode === 'platform';
    });
}

export function useCanShowInternalAdmins() {
    const organization = useOrganization();

    return computed(() => {
        return organization.value ? organization.value.canShowInternalAdmins : STAMHOOFD.userMode === 'platform';
    });
}
