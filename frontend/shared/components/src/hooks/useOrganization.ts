import { Organization } from "@stamhoofd/structures";
import { Ref, computed } from "vue";
import { useContext } from "./useContext";

export function useOrganization(): Ref<Organization | null> {
    const context = useContext()
    return computed(() => context.value.organization);
}
