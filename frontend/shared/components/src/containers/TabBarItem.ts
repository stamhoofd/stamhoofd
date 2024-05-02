import { ComponentWithProperties } from "@simonbackx/vue-app-navigation"

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
    }
}