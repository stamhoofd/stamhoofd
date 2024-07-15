import { computed, Ref } from "vue";
import { useOrganization } from "./useOrganization";

export function useMembersPackage(): Ref<boolean> {
    const organization = useOrganization();

    return computed(() => {
        return organization.value?.meta.modules.useMembers ?? true
    })
}
