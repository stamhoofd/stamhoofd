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

    get isGroup() {
        return false;
    }

    /**
     * Helper to treat groups and items the same
     */
    get items() {
        return [this]
    }
}

export class TabBarItemGroup {
    name = ""
    icon = ""
    badge: string | null = ""
    items: TabBarItem[] = []

    constructor(options: { name: string, icon: string, items: TabBarItem[] }) {
        this.name = options.name
        this.icon = options.icon
        this.items = options.items

        // Not reactive because we need === operator to know what the active tab is
        markRaw(this)
    }

    get isGroup() {
        return true;
    }
}