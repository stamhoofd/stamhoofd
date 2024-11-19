import { MemberProperty, PermissionLevel } from '@stamhoofd/structures';
import { Ref, computed } from 'vue';
import { PlatformMember } from '../../../../../../shared/structures/esm/dist/src/members/PlatformMember';
import { useAppContext } from '../../context/appContext';
import { useAuth, useContext } from '../../hooks';

export function useIsPropertyRequired(member: Ref<PlatformMember | PlatformMember[]>) {
    const isAllOptional = useIsAllOptional(member);

    return (property: MemberProperty, customMember?: PlatformMember) => {
        const members = customMember ? [customMember] : (Array.isArray(member.value) ? member.value : [member.value]);
        return members.some((m) => {
            if (isAllOptional.value) {
                return m.isPropertyRequiredForPlatform(property) && (['birthDay'].includes(property));
            }
            return m.isPropertyRequired(property);
        });
    };
}

export function useIsPropertyEnabled(member: Ref<PlatformMember | PlatformMember[]>, write: boolean) {
    const context = useContext();

    return (property: MemberProperty, customMember?: PlatformMember) => {
        const members = customMember ? [customMember] : (Array.isArray(member.value) ? member.value : [member.value]);
        return members.some((m) => {
            return m.isPropertyEnabled(property, context.value.user
                ? {
                        checkPermissions: {
                            user: context.value.user,
                            level: write ? PermissionLevel.Write : PermissionLevel.Read,
                        },
                    }
                : {});
        });
    };
}

export function useIsAllOptional(member: Ref<PlatformMember | PlatformMember[]>) {
    const auth = useAuth();
    const app = useAppContext();

    return computed(() => {
        const members = Array.isArray(member.value) ? member.value : [member.value];
        return members.some((m) => {
            if (auth.canAccessPlatformMember(m, PermissionLevel.Write) && app !== 'registration') {
                return true;
            }
            return false;
        });
    });
}
