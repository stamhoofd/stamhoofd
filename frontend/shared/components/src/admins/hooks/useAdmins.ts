import { AutoEncoderPatchType } from "@simonbackx/simple-encoding"
import { usePop } from "@simonbackx/vue-app-navigation"
import { Toast, useContext, useOrganization } from "@stamhoofd/components"
import { ContextPermissions, OrganizationManager, usePlatformManager } from "@stamhoofd/networking"
import { User, UserPermissions, Permissions } from "@stamhoofd/structures"
import { Sorter } from "@stamhoofd/utility"
import { computed, getCurrentInstance, onActivated } from "vue"


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

    function reload() {
        if (organization.value) {
            const manager = new OrganizationManager($context.value!)
            promise = manager.loadAdmins(true, true, instance?.proxy).catch((e) => {
                Toast.fromError(e).show()
                pop({force: true})?.catch(console.error)
            })
        } else {
            promise = platformManager.value.loadAdmins(true, true, instance?.proxy).catch((e) => {
                Toast.fromError(e).show()
                pop({force: true})?.catch(console.error)
            })
        }
    }
    
    if (loading.value) {
        reload()
    }

    onActivated(() => {
        // Reload admins
        reload();
    })

    const admins = computed(() => {
        if (organization.value) {
            return organization.value?.admins ?? []
        }

        // Platform scope
        return platformManager.value.$platform.admins ?? []
    })

    const getPermissions = (user: User) => {
        return new ContextPermissions(user, organization, platformManager.value.$platform, {allowInheritingPermissions: false}).permissions
    }

    const getPermissionsPatch = (user: User, patch: AutoEncoderPatchType<Permissions>|null): AutoEncoderPatchType<UserPermissions>|UserPermissions => {
        if (organization.value) {
            if (!user.permissions) {
                const base = UserPermissions.create({})
                const p = base.convertPatch(patch, organization.value.id)
                return base.patch(p)
            }
            return user.permissions!.convertPatch(patch, organization.value.id)
        }
        return user.permissions!.convertPlatformPatch(patch)
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

    const dropFromMemory = (user: User) => {
        if (organization.value) {
            const index = organization.value?.admins?.findIndex((u) => u.id == user.id)

            if (index !== undefined && index !== -1) {
                organization.value?.admins?.splice(index, 1)
            }
            return;
        }

        // Platform scope
        const index = platformManager.value.$platform.admins?.findIndex((u) => u.id == user.id)

        if (index !== undefined && index !== -1) {
            platformManager.value.$platform.admins?.splice(index, 1)
        }
    }

    return { loading, admins, promise, sortedAdmins, getPermissions, getPermissionsPatch, pushInMemory, dropFromMemory}
}
