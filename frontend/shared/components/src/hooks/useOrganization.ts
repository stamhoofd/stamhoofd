import { Organization } from "@stamhoofd/structures";
import { Ref, computed } from "vue";
import { useContext } from "./useContext";

export function useOrganization(): Ref<Organization | null> {
    const context = useContext()
    return computed(() => context.value.organization);
}

export function useOrganizationThrowIfNull(): Ref<Organization> {
    const context = useContext()
    return computed(() => {
        const result = context.value.organization;
        if(result === null) {
            const message = 'Organization is not set.';
            console.error(message);
            throw new Error(message);
        }
        return result;
    });
}
