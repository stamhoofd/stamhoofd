import { ComponentWithProperties } from "@simonbackx/vue-app-navigation"
import { ComponentPublicInstance, markRaw, Ref } from "vue"

export class TabBarItem {
    name = ""
    icon = ""
    badge: string | Ref<string> | null = ""
    component?: ComponentWithProperties
    action?: (this: ComponentPublicInstance) => Promise<void>|void
    savedScrollPositions: WeakMap<HTMLElement, number> = new WeakMap()

    constructor(options: { name: string, icon: string, badge?: string | Ref<string> | null, component?: ComponentWithProperties, action?: (this: ComponentPublicInstance) => Promise<void>|void }) {
        this.name = options.name
        this.icon = options.icon
        this.component = options.component
        this.badge = options.badge ?? ""
        this.action = options.action;

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
    badge: string | Ref<string> | null = ""
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