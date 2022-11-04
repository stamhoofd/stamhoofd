import { ComponentWithProperties } from "@simonbackx/vue-app-navigation"

import GeneralContextMenuView from "./GeneralContextMenuView.vue"
import { ModalStackEventBus } from "./ModalStackEventBus"

export class ContextMenuItem {
    name: string
    description?: string

    leftIcon: string | null = null
    rightText: string | null = null
    icon: string | null = null

    /**
     * Shows a checkbox on the left if true/false.
     * You can  alter the selected value in action() to adjust it.
     */
    selected: boolean | null = null
    disabled: boolean | string = false

    /**
     * Return true when the context menu should get closed.
     */
    action: ((this: ContextMenuItem) => boolean) | null = null

    /**
     * Context menu to show when hovered
     */
    childMenu: ContextMenu | null = null

    constructor(settings: Partial<ContextMenuItem>) {
        Object.assign(this, settings)
    }
}

export class ContextMenu {
    /**
     * Prevent the default behaviour of click on the item, e.g. to keep the focus on an input element
     */
    preventDefault = false

    items: ContextMenuItem[][]

    constructor(items: ContextMenuItem[][]) {
        this.items = items.filter(i => i.length > 0)
    }

    getComponent() {
        return new ComponentWithProperties(GeneralContextMenuView, { menu: this})
    }

    async show(position: { clickEvent?: TouchEvent | MouseEvent, button?: HTMLElement, x?: number, y?: number, xPlacement?: "right" | "left", yPlacement?: "bottom" | "top" , wrapWidth?: number, wrapHeight?: number, yOffset?: number, xOffset?: number }) {
        if (position.button) {
            const bounds = position.button.getBoundingClientRect()

            if (!position.xPlacement || position.xPlacement === "right") {
                position.x = bounds.left
            } else {
                position.x = bounds.right
            }

            if (!position.yPlacement || position.yPlacement === "bottom") {
                position.y = bounds.bottom
            } else {
                position.y = bounds.top
            }

            position.wrapWidth = bounds.width
            position.wrapHeight = bounds.height
        }

        if (position.clickEvent) {
            const event = position.clickEvent as any
            position.x = event.changedTouches ? event.changedTouches[0].pageX : event.clientX
            position.y = event.changedTouches ? event.changedTouches[0].pageY : event.clientY
        }

        if (position.y !== undefined && position.yOffset) {
            position.y += position.yOffset
        }

        if (position.x !== undefined && position.xOffset) {
            position.x += position.xOffset
        }

        const component = new ComponentWithProperties(GeneralContextMenuView, {
            menu: this,
            ...position
        })
        await ModalStackEventBus.sendEvent("present", {
            components: [component],
            modalDisplayStyle: "overlay",
        })
        return this
    }
}