import { ComponentWithProperties } from "@simonbackx/vue-app-navigation"

import PromiseView from "./PromiseView.vue"

export function AsyncComponent(component: () => Promise<any>, properties = {}) {
    return new ComponentWithProperties(PromiseView, {
        promise: async function() {
            const c = (await component()).default
            return new ComponentWithProperties(c, properties)
        }
    })
}