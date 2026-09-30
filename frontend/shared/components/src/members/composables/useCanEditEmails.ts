import { useAuth } from '#hooks/useAuth.ts';
import { useUser } from '#hooks/useUser.ts';
import type { Parent, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';

export function useCanEditEmails(member: PlatformMember | null, parent?: Parent) {
    const user = useUser();
    const auth = useAuth();

    const hasPlatformFullAccess = auth.hasPlatformFullAccess();

    return computed(() => {
        if (hasPlatformFullAccess) return true;

        const isUserMember = user.value?.members.members.some(m => m.id === member?.id);
        if (isUserMember) return true;

        const isParentMember = user.value?.members.members.some(m => m.details.parents.some(p => p.id === parent?.id));
        if (isParentMember) return true;

        const responsibilities = member?.getResponsibilities();

        const responsibilitiesFullAdmin = responsibilities?.every((r) => {
            if (r.organizationId === null) {
                return false;
            }

            const organization = member?.organizations.find(o => o.id === r.organizationId);
            if (!organization) return false;

            return auth.getPermissionsForOrganization(organization)?.hasFullAccess() ?? false;
        });

        return responsibilities?.length === 0
            || (responsibilities && responsibilities.length > 0
                && responsibilitiesFullAdmin
            )
        ;
    });
}
