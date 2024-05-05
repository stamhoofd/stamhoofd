import { ComponentWithProperties } from "@simonbackx/vue-app-navigation"
import { markRaw } from "vue"

export class TabBarItem {
    name = ""
    icon = ""
    badge: string | null = ""
    component: ComponentWithProperties
    savedScrollPositions: WeakMap<HTMLElement, number> = new WeakMap()

    constructor(options: { name: string, icon: string, component: ComponentWithProperties }) {
        this.name = options.name
        this.icon = options.icon
        this.component = options.component

        // Not reactive because we need === operator to know what the active tab is
        markRaw(this)
    }
}