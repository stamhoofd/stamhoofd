import { usePop } from "@simonbackx/vue-app-navigation"
import { Toast, useContext, useOrganization } from "@stamhoofd/components"
import { OrganizationManager, usePlatformManager } from "@stamhoofd/networking"
import { getCurrentInstance } from "vue"

export function useReloadAdmins() {
    const organization = useOrganization()
    const platformManager = usePlatformManager()
    const $context = useContext()
    const instance = getCurrentInstance()
    const pop = usePop()

    let reloadPromise: Promise<unknown> | undefined = undefined

    function reload() {
        if (organization.value) {
            const manager = new OrganizationManager($context.value!)
            reloadPromise = manager.loadAdmins(true, true, instance?.proxy).catch((e) => {
                Toast.fromError(e).show()
                pop({force: true})?.catch(console.error)
            })
        } else {
            reloadPromise = platformManager.value.loadAdmins(true, true, instance?.proxy).catch((e) => {
                Toast.fromError(e).show()
                pop({force: true})?.catch(console.error)
            })
        }
    }

    return {  reload, reloadPromise: () => reloadPromise }
}
