import { computed, Ref } from "vue";
import { useOrganization } from "./useOrganization";
import { AppManager } from "@stamhoofd/networking";

export function useSalesDisabled(): Ref<boolean> {
    const organization = useOrganization();

    return computed(() => {
        return  AppManager.shared.isNative && organization.value?.id === "34541097-44dd-4c68-885e-de4f42abae4c"
    })
}
