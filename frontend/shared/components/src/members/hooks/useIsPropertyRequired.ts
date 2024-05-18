import { PermissionLevel } from "@stamhoofd/structures";
import { Ref, computed } from "vue";
import { PlatformMember } from "../../../../../../shared/structures/esm/dist/src/members/PlatformMember";
import { useAppContext } from "../../context/appContext";
import { useAuth } from "../../hooks";

export function useIsPropertyRequired(member: Ref<PlatformMember>) {
    const isAllOptional = useIsAllOptional(member);

    return (property: 'birthDay'|'gender'|'address'|'parents'|'emailAddress'|'phone'|'emergencyContacts') => {
        const m = member.value
        if (isAllOptional.value) {
            return m.isPropertyRequiredForPlatform(property)
        }
        return m.isPropertyRequired(property)
    }
}

export function useIsAllOptional(member: Ref<PlatformMember>) {
    const auth = useAuth();
    const app = useAppContext();

    return computed(() => {
        const m = member.value
        if (auth.canAccessPlatformMember(m, PermissionLevel.Write) && app !== 'registration') {
            return true
        }
        return false;
    })
}
