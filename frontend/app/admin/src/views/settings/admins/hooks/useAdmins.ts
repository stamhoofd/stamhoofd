import { usePop } from "@simonbackx/vue-app-navigation"
import { Toast, useContext, useOrganization } from "@stamhoofd/components"
import { ContextPermissions, OrganizationManager, usePlatformManager } from "@stamhoofd/networking"
import { User } from "@stamhoofd/structures"
import { Sorter } from "@stamhoofd/utility"
import { computed, getCurrentInstance } from "vue"


export function useAdmins() {
    const organization = useOrganization()
    const platformManager = usePlatformManager()
    const $context = useContext()
    const instance = getCurrentInstance()
    const pop = usePop()

    let promise: Promise<unknown> | undefined = undefined

    const loading = computed(() => {
        if (organization.value) {
            return organization.value?.admins === undefined
        }
    
        // Platform scope
        return platformManager.value.$platform.admins === undefined
    })
    
    if (loading.value) {
        if (organization.value) {
            const manager = new OrganizationManager($context.value!)
            promise = manager.loadAdmins(true, true, instance?.proxy).catch((e) => {
                Toast.fromError(e).show()
                pop({force: true})
            })
        } else {
            promise = platformManager.value.loadAdmins(true, true, instance?.proxy).catch((e) => {
                Toast.fromError(e).show()
                pop({force: true})
            })
        }
    }

    const admins = computed(() => {
        if (organization.value) {
            return organization.value?.admins ?? []
        }

        // Platform scope
        return platformManager.value.$platform.admins ?? []
    })

    const getPermissions = (user: User) => {
        return new ContextPermissions(user, organization, platformManager.$platform).permissions
    }

    const sortedAdmins = computed(() => {
        return admins.value.slice().sort((a, b) => Sorter.stack(
            Sorter.byBooleanValue(getPermissions(a)?.hasFullAccess() ?? false, getPermissions(b)?.hasFullAccess() ?? false), 
            Sorter.byStringValue(a.firstName+" "+a.lastName, b.firstName+" "+b.lastName)
        ))
    })

    const pushInMemory = (user: User) => {
        if (organization.value) {
            return organization.value?.admins?.push(user)
        }

        // Platform scope
        return platformManager.value.$platform.admins?.push(user)
    }

    return { loading, admins, promise, sortedAdmins, getPermissions, pushInMemory}
}