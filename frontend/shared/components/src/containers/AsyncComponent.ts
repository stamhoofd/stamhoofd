import { ComponentWithProperties } from "@simonbackx/vue-app-navigation"

import { sleep } from "@stamhoofd/utility"
import { AppManager } from "../../../networking"
import { Toast } from "../overlays/Toast"
import PromiseView from "./PromiseView.vue"

/**
 * In the app, we don't need to wait for components to load (because they are present).
 * So pass the promise to prevent DOM updates
 */
export async function LoadComponent(component: () => Promise<any>, properties = {}, settings?: { instant: boolean}) {
    try {
        if (settings?.instant) {
            return AsyncComponent(component, properties)
        }
        if (!AppManager.shared.isNative) {
            // Instead of initiating a loading dom, we can wait maximum 50ms
            // for the promise to resolve and decide if we need to show the loading dom or not
            const promise = component()
            const speedRun = sleep(50).then(() => null)
            const result = await Promise.any([promise, speedRun])

            if (result === null) {
                return new ComponentWithProperties(PromiseView, {
                    promise: async function() {
                        try {
                            const c = (await promise).default
                            return new ComponentWithProperties(c, properties)
                        } catch (e) {
                            if (AppManager.shared.isNative) {
                                new Toast("Geen internetverbinding. Herlaad de applicatie.", "error red").show()
                            } else {
                                new Toast("Geen internetverbinding. Kijk jouw verbinding na en herlaad de website.", "error red").show()
                            }
                            throw e
                        }
                    }
                })
            }
            return new ComponentWithProperties(result.default, properties)
        }
        const c = (await component()).default
        return new ComponentWithProperties(c, properties)
    } catch (e) {
        if (AppManager.shared.isNative) {
            new Toast("Geen internetverbinding. Herlaad de applicatie.", "error red").show()
        } else {
            new Toast("Geen internetverbinding. Kijk jouw verbinding na en herlaad de website.", "error red").show()
        }
        throw e
    }
    
}

export function PromiseComponent(component: () => Promise<ComponentWithProperties>) {
    return new ComponentWithProperties(PromiseView, {
        promise: async function() {
            try {
                const c = (await component())
                return c
            } catch (e) {
                if (AppManager.shared.isNative) {
                    new Toast("Geen internetverbinding. Herlaad de applicatie.", "error red").show()
                } else {
                    new Toast("Geen internetverbinding. Kijk jouw verbinding na en herlaad de website.", "error red").show()
                }
                throw e
            }
        }
    })
}


export function AsyncComponent(component: () => Promise<any>, properties = {}) {
    return new ComponentWithProperties(PromiseView, {
        promise: async function() {
            try {
                const c = (await component()).default
                return new ComponentWithProperties(c, properties)
            } catch (e) {
                if (AppManager.shared.isNative) {
                    new Toast("Geen internetverbinding. Herlaad de applicatie.", "error red").show()
                } else {
                    new Toast("Geen internetverbinding. Kijk jouw verbinding na en herlaad de website.", "error red").show()
                }
                throw e
            }
        }
    })
}
