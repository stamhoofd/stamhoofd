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
        // No organization means we're in a platform-wide context, where internal admins are always relevant.
        return organization.value ? organization.value.showInternalAdmins : true;
    });
}
