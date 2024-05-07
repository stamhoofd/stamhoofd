import { useOrganization } from "@stamhoofd/components"
import { usePlatformManager } from "@stamhoofd/networking"
import { computed } from "vue"

export function useRoles() {
    const organization = useOrganization()
    const platformManager = usePlatformManager()

    return computed(() => {
        if (organization.value) {
            return organization.value?.privateMeta?.roles ?? []
        }
    
        // Platform scope
        return platformManager.value.$platform.privateConfig?.roles ?? []
    })
}