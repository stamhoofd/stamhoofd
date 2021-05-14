import { ComponentWithProperties } from "@simonbackx/vue-app-navigation"

export class TabBarItem {
    name = ""
    icon = ""
    badge: string | null = ""
    component: ComponentWithProperties
    savedScrollPosition: null | number = null

    constructor(name: string, icon: string, component: ComponentWithProperties) {
        this.name = name
        this.icon = icon
        this.component = component
    }
}