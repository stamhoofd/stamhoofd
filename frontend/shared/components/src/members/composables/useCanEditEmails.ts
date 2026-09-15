import { useAuth } from '#hooks/useAuth.ts';
import { useUser } from '#hooks/useUser.ts';
import type { Parent, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';

export function useCanEditEmails(member: PlatformMember | null, parent?: Parent) {
    const user = useUser();
    const auth = useAuth();

    return computed(() => {
        const isUserMember = user.value?.members.members.some(m => m.id === member?.id);
        const isParentMember = user.value?.members.members.some(m => m.details.parents.some(p => p.id === parent?.id));
        const responsibilities = member?.getResponsibilities();

        const hasPlatformFullAccess = auth.hasPlatformFullAccess();
        const hasFullAccess = auth.hasFullAccess();

        const responsibilitiesFullAdmin = responsibilities?.every((r) => {
            if (r.organizationId === null) {
                return hasPlatformFullAccess;
            }
            return hasFullAccess;
        });

        return isUserMember
            || isParentMember
            || responsibilities?.length === 0
            || (responsibilities && responsibilities.length > 0
                && responsibilitiesFullAdmin
            )
        ;
    });
}
