<template>
    <transition appear name="show">
        <div v-if="!hide" class="context-menu-container" :class="{ hasParent: !!parentMenu, disableDismiss: !autoDismiss }" @click="pop" @contextmenu.prevent>
            <div
                ref="context"
                class="context-menu"
                :class="usedXPlacement+' '+usedYPlacement"
                :style="{ transformOrigin, top: top !== null ? top + 'px' : undefined, left: left !== null ? (left + 'px') : undefined, right: right !== null ? (right + 'px') : undefined, bottom: bottom !== null ? (bottom + 'px') : undefined, width: usedPreferredWidth !== null ? (usedPreferredWidth + 'px') : undefined, height: usedPreferredHeight !== null ? (usedPreferredHeight + 'px') : undefined }"
                @click.stop=""
            >
                <slot />
            </div>

            <div v-if="ignoreHoverTriangle && false" class="triangle" :style="{ 'clip-path': 'polygon('+ignoreHoverTriangle.p1.x+'px '+ignoreHoverTriangle.p1.y+'px, '+ignoreHoverTriangle.p2.x+'px '+ignoreHoverTriangle.p2.y+'px, '+ignoreHoverTriangle.p3.x+'px '+ignoreHoverTriangle.p3.y+'px)'}" />
        </div>
    </transition>
</template>

<script lang="ts">
import { ComponentWithProperties, injectHooks, usePop } from "@simonbackx/vue-app-navigation";

import { Component, Prop, VueComponent } from "@simonbackx/vue-app-navigation/classes";
import { ViewportHelper } from "../ViewportHelper";
import ContextMenuItemView from "./ContextMenuItemView.vue";

function triangleContains(ax, ay, bx, by, cx, cy, x, y) {

    let det = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)

    return  det * ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) >= 0 &&
            det * ((cx - bx) * (y - by) - (cy - by) * (x - bx)) >= 0 &&
            det * ((ax - cx) * (y - cy) - (ay - cy) * (x - cx)) >= 0    

}

@Component({
    inheritAttrs: false
})
export default class ContextMenuView extends VueComponent {
    @Prop({
        default: 0,
    })
        x!: number;

    @Prop({
        default: null,
    })
        preferredWidth!: number | null;

    usedPreferredHeight: number | null = null;
    usedPreferredWidth: number | null = this.preferredWidth;
    hide = false

    @Prop({
        default: 0,
    })
        y!: number;

    top: number | null = null
    left: number | null = null
    right: number | null = null
    bottom: number | null = null

    transformOrigin = "0 0"

    @Prop({
        default: "right",
    })
        xPlacement!: "right" | "left";

    usedXPlacement: "right" | "left" = this.xPlacement

    @Prop({
        default: "bottom",
    })
        yPlacement!: "bottom" | "top";

    usedYPlacement: "bottom" | "top" = this.yPlacement

    @Prop({
        default: null,
    })
        parentMenu!: ContextMenuView | null;

    /**
     * In case a placement is not possible, instead of just swapping xPlacement, also affect the x position first with the wrapWidth (needed for e.g. context menu's)
     */
    @Prop({
        default: null,
    })
        wrapWidth!: number | null

    /**
     * In case a placement is not possible, instead of just swapping xPlacement, also affect the x position first with the wrapWidth (needed for e.g. context menu's)
     */
    @Prop({
        default: null,
    })
        wrapHeight!: number | null

    @Prop({
        default: true,
    })
        autoDismiss!: boolean;

    isPopped = false

    disableHoverChildMenus = false

    created(this: any) {
        // we cannot use setup in mixins, but we want to avoid having to duplicate the 'use' hooks logic.
        // so this is a workaround
        const definitions: any = {
            parentPop: usePop()
        };

        injectHooks(this, definitions);
    }

    mounted() {
        // Calculate position
        let width = (this.$refs.context as HTMLElement).offsetWidth;
        let height = (this.$refs.context as HTMLElement).offsetHeight;


        const win = window,
            doc = document,
            docElem = doc.documentElement,
            body = doc.getElementsByTagName("body")[0],
            clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
            clientHeight = win.innerHeight || docElem.clientHeight || body.clientHeight;
        
        
        const viewPadding = 15;
        const viewPaddingBottom = Math.max(clientHeight < 900 ? 5 : 15, ViewportHelper.getBottomPadding());
        const viewPaddingTop = clientHeight < 900 ? 5 : 15

        if (width > clientWidth - viewPadding * 2) {
            this.usedPreferredWidth = clientWidth - viewPadding * 2;
            width = this.usedPreferredWidth
        }

        if (height > clientHeight - viewPaddingTop - viewPaddingBottom) {
            this.usedPreferredHeight = clientHeight - viewPaddingTop - viewPaddingBottom;
            height = this.usedPreferredHeight
        }

        if (width > clientWidth / 2) {
            // Screen is too small to fit multiple context menus
            this.disableHoverChildMenus = true
        }

        let usedX = this.x

        if (this.xPlacement === "right") {
            this.left = this.x; 
            
            // If the remaining space is too small, we need to wrap
            if (width > clientWidth - viewPadding - this.x) {
                this.left = null
                this.usedXPlacement = "left"

                if (this.wrapWidth !== null) {
                    // Wrap instead of sticking to right
                    usedX = usedX - this.wrapWidth
                    this.right = Math.min(clientWidth - usedX, clientWidth - viewPadding - width);

                    if (this.right < viewPadding) {
                        this.right = viewPadding
                    }
                } else {
                    this.right = viewPadding
                }
            } else {
                if (this.left < viewPadding) {
                    this.left = viewPadding
                }
            }
            //- Math.max(0, width - (clientWidth - viewPadding - usedX);

        } else {
            this.right = Math.min(clientWidth - usedX, clientWidth - viewPadding - width)

            if (this.right < viewPadding) {
                this.right = viewPadding
            }
        }

        let usedY = this.y

        if (this.yPlacement === "bottom") {
            this.top = this.y// - Math.max(0, height - (clientHeight - viewPadding - this.y)); // remove border

            // If the remaining space is too small, we need to wrap
            if (height > clientHeight - viewPaddingBottom - this.y) {
                this.top = null
                this.usedYPlacement = "top"

                if (this.wrapHeight !== null && height <= usedY - this.wrapHeight - viewPaddingTop) {
                    // Wrap instead of sticking to bottom
                    usedY = usedY - this.wrapHeight
                    this.bottom = Math.min(clientHeight - usedY, clientHeight - viewPaddingTop - height);

                    if (this.bottom < viewPaddingBottom) {
                        this.bottom = viewPaddingBottom
                    }
                } else {
                    this.bottom = viewPaddingBottom
                }
            } else {
                if (this.top < viewPaddingTop) {
                    this.top = viewPaddingTop
                }
            }
        } else {
            this.bottom = Math.min(clientHeight - usedY, clientHeight - viewPaddingTop - height); // remove border

            if (this.bottom < viewPaddingBottom) {
                this.bottom = viewPaddingBottom
            }
        }

        const objLeft = this.left ? this.left : (clientWidth - this.right! - width)
        const xTransform = ((usedX - objLeft) / width * 100).toFixed(2)

        const objTop = this.top ? this.top : (clientHeight - this.bottom! - height)
        const yTransform = ((usedY - objTop) / height * 100).toFixed(2)

        this.transformOrigin = xTransform + "% "+yTransform+"%"

        if (!this.usedPreferredHeight) {
            // Allow scrolling if height is restricted, else add touch listeners to allow selection by dragging
            window.addEventListener("touchmove", this.onTouchMove, { passive: false });
            window.addEventListener("touchend", this.onTouchUp, { passive: false });
        }
       
        if (this.isPopped || this.parentMenu?.isPopped || (this.parentMenu && (!this.parentMenu.$el || !this.parentMenu.$el.isConnected))) {
            // Pop was dismissed before we could mount this context menu
            console.error("Context menu lost its parent menu during mounting")
            this.pop(false)
        }
    }

    beforeUnmount() {
        this.popChildMenu()
        window.removeEventListener("touchmove", this.onTouchMove);
        window.removeEventListener("touchend", this.onTouchUp);
    }

    childMenu: ComponentWithProperties | null = null

    popChildMenu() {
        if (this.childMenu) {
            const instance =  this.childMenu.componentInstance() as any

            if (instance) {
                instance.$children[0].pop(false)
            }
        }
        this.childMenu = null
    }

    currentlyHoveredItem: ContextMenuItemView | null = null

    // When we hover an item that has a child menu, we need to cancel other hovers if the mouse moves to the child menu
    ignoreHover = false
    ignoreHoverItem: ContextMenuItemView | null = null
    ignoreHoverTimeout: NodeJS.Timeout | null = null
    ignoreHoverTriangle: { p1: { x: number, y: number }, p2: { x: number, y: number }, p3: { x: number, y: number } } | null = null

    delayHover(ms: number) {
        this.ignoreHover = true
        if (this.ignoreHoverTimeout) {
            clearTimeout(this.ignoreHoverTimeout)
        }

        if (ms <= 0) {
            if (this.currentlyHoveredItem  && this.ignoreHoverItem === this.currentlyHoveredItem) {
                // Ignore, and wait for next timer
                return
            }
            this.endIgnoreHover()
            return
        }
        this.ignoreHoverTimeout = setTimeout(() => {
            if (this.currentlyHoveredItem && this.ignoreHoverItem === this.currentlyHoveredItem) {
                // Ignore, and wait for next timer
                return
            }
            this.endIgnoreHover()
        }, ms)
    }

    endIgnoreHover() {
        this.ignoreHover = false

        // Remove listener
        window.removeEventListener("mousemove", this.onMouseMove);

        this.ignoreHoverTriangle = null

        const item = this.ignoreHoverItem
        this.ignoreHoverItem = null

        if (this.isPopped) {
            return
        }
        
        // Execute mouseover again: if we are above a different context menu item: close the popup and/or open a new one
        if (this.currentlyHoveredItem && this.currentlyHoveredItem !== item) {
            this.onHoverItem(this.currentlyHoveredItem)
        }
    }

    hoverTimeout: NodeJS.Timeout | null = null

    onHoverItem(item: ContextMenuItemView) {
        this.currentlyHoveredItem = item

        if (this.shouldIgnoreHover()) {
            return;
        }

        // Update hover style
        const wasHovered = item.isHovered
        item.isHovered = true

        if (this.disableHoverChildMenus) {
            // Never automatically show a child menu
            return
        }

        if (!wasHovered && this.hoverTimeout) {
            clearTimeout(this.hoverTimeout)
            this.hoverTimeout = null
        }

        if (item.childContextMenu) {
            if (!wasHovered) {
                this.setChildMenu(null);
                this.hoverTimeout = setTimeout(() => {
                    if (item.isHovered && this.currentlyHoveredItem === item && !this.shouldIgnoreHover() && item.childContextMenu && !item.childContextMenu.componentInstance()) {
                        // TODO: Wait x ms hover delay, and check is the cursor is still hovered

                        if (this.isPopped) {
                            return
                        }
                        // Present child context menu + send close event to parent
                        const el = item.$el as HTMLElement;

                        if (el.classList.contains('disabled')) {
                            return
                        }
                        const bounds = el.getBoundingClientRect()

                        item.childContextMenu.properties.x = bounds.right
                        item.childContextMenu.properties.y = bounds.top
                        item.childContextMenu.properties.xPlacement = "right"
                        item.childContextMenu.properties.yPlacement = "bottom"
                        item.childContextMenu.properties.parentMenu = this
                        item.childContextMenu.properties.wrapWidth = el.clientWidth;
                        
                        this.setChildMenu(item.childContextMenu);
                        item.present(item.childContextMenu.setDisplayStyle("overlay"));
                    }
                }, 150)
            }
            
        } else {
            this.setChildMenu(null);
        }
    }

    onMouseLeaveItem(item: ContextMenuItemView) {
        if (this.currentlyHoveredItem === item) {
            this.currentlyHoveredItem = null

            if (item === this.ignoreHoverItem) {
                this.delayHover(50)
            }
        }

        // Update hover style if changed
        item.isHovered = false
    }

    onClickItem(item: ContextMenuItemView, event) {
        if (item.clicked) {
            return;
        }
        item.clicked = true

        if (item.childContextMenu) {
            // No click actions
            if (this.disableHoverChildMenus || (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || ((navigator as any).msMaxTouchPoints > 0))) {
                // Show child menu and replace self

                if (!item.childContextMenu.componentInstance() && !this.shouldIgnoreHover()) {
                    this.pop(true)

                    // Present child context menu + send close event to parent
                    const el = item.$el as HTMLElement;
                    const bounds = el.getBoundingClientRect()

                    // TODO: calculate better position
                    item.childContextMenu.properties.x = bounds.left
                    item.childContextMenu.properties.y = bounds.top
                    item.childContextMenu.properties.xPlacement = "right"
                    item.childContextMenu.properties.yPlacement = "bottom"
                    item.childContextMenu.properties.parentMenu = null
                    item.present(item.childContextMenu.setDisplayStyle("overlay"));
                }
            }
            return
        }

        // We need to delay click events because otherwise for some unknown reason, it would trigger again on a 'popup' and close it immediately
        setTimeout(() => {
            item.$emit("click", event);
        }, 10)

        // Wait to pop to let the browser handle events (e.g. label > checkbox)
        this.delayPop(true);
    }

    setChildMenu(component: ComponentWithProperties | null) {
        if (this.childMenu === component) {
            return
        }

        this.popChildMenu()
        this.childMenu = component;

        // Capture initial mouse X + Y Position,
        // calculate the triangle in which region we shouldn't hover
        // keep adjusting the triangle as the mouse moves, but if the mouse stops too long, stop

        if (component && this.currentlyHoveredItem && !this.ignoreHoverItem) {
            // If the cursor now moves to the newly created context menu, we'll add a delay and prevent any other context menu hovering
            this.ignoreHoverItem = this.currentlyHoveredItem

            // We cant calculate the triangle yet, because the child menu is not yet mounted
            this.ignoreHoverTriangle = null
            this.delayHover(50)
            window.addEventListener("mousemove", this.onMouseMove, { passive: true });
        }
    }

    calculateHoverTriangle(mouseX, mouseY) {
        if (!this.childMenu) {
            return
        }
        const instance = this.childMenu.componentInstance()
        if (!instance) {
            return
        }

        // Get the child element, since the main element covers the whole window
        const element = instance.$el.childNodes[0] as HTMLElement

        if (!element) {
            return
        }


        const bounds = element.getBoundingClientRect()

        const contextX = bounds.left
        const contextY = bounds.top
        const contextY2 = bounds.bottom
        const contextX2 = bounds.right

        if (contextX < mouseX) {
            // Menu is on the left side

            return {
                p1: { x: mouseX + 5, y: mouseY },
                p2: { x: contextX2, y: contextY },
                p3: { x: contextX2, y: contextY2 }
            }

        } else {
            return {
                p1: { x: mouseX - 5, y: mouseY },
                p2: { x: contextX, y: contextY },
                p3: { x: contextX, y: contextY2 }
            }
        }
    }

    updateHoverTriangle(mouseX, mouseY) {
        const triangle = this.calculateHoverTriangle(mouseX, mouseY)
        if (triangle) {
            this.ignoreHoverTriangle = triangle
        }
    }

    shouldIgnoreHover() {
        return this.isPopped || (
            this.childMenu && (
                this.ignoreHover
            )
        )
    }
    
    onMouseMove(event) {
        if (!this.childMenu) {
            // Wait for timer to end
            return
        }

        const mouseX = event.clientX
        const mouseY = event.clientY

        const isStillHovered = this.currentlyHoveredItem && this.currentlyHoveredItem === this.ignoreHoverItem

        if (this.ignoreHoverTriangle === null || isStillHovered) {
            // We don't have triangle yet, probably because we didn't yet have the position
            // of the mouse and the context menu
            
            // Just update the triangle for now, but don't expand the delay

            this.updateHoverTriangle(mouseX, mouseY)

            return
        }

        // Check if mouse position is inside the triangle

        const p1 = this.ignoreHoverTriangle.p1
        const p2 = this.ignoreHoverTriangle.p2
        const p3 = this.ignoreHoverTriangle.p3

        if (!triangleContains(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, mouseX, mouseY)) {
            // Outside triangle:
            // stop delay if we aren't hovering any longer
            this.delayHover(0)
            return
        }


        // Mouse is inside the triangle
        // Expand

        this.delayHover(50)

        // TODO: adjust triangle

        // if X position got closer, then we'll adjust the triangle again
        const triangle = this.calculateHoverTriangle(mouseX, mouseY)
        if (triangle && Math.abs(p1.x - p2.x) > Math.abs(triangle.p1.x - triangle.p2.x)) {
            this.ignoreHoverTriangle = triangle
        }

        return


    }

    getSelectedElementAt(x, y): HTMLElement | null {
        // Check which one is hovered, and manually add a hover state to it
        let selectedElement = document.elementFromPoint(x, y);

        // Get parent until class is context-menu-item or stop when parent is document, or context-menu-container class
        while (selectedElement && !selectedElement.classList.contains("context-menu-item") && !selectedElement.classList.contains("context-menu-container")) {
            selectedElement = selectedElement.parentElement;
        }
        if (selectedElement && selectedElement.classList.contains("context-menu-item")) {
            return selectedElement as HTMLElement
        }
        return null
    }


    getSelectedElement(event): HTMLElement | null {
        // Check which one is hovered, and manually add a hover state to it
        return this.getSelectedElementAt(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
    }

    onTouchMove(event) {
        // Check which one is hovered, and manually add a hover state to it
        const selectedElement = this.getSelectedElement(event);

        this.$el.querySelectorAll(".context-menu-item").forEach(item => {
            item.classList.remove("hover")
            item.classList.add("disable-active")
        })

        if (selectedElement) {
            selectedElement.classList.add("hover")
        }

        event.preventDefault()
    }

    onTouchUp(event) {
        if (this.isPopped) {
            // We're already popped, so we don't need to do anything
            return
        }
        const selectedElement = this.getSelectedElement(event);
        if (selectedElement) {
            selectedElement.click()
        }
    }

    delayPop(popParents = false) {
        if (this.isPopped) {
            // Ignore
            return
        }

        this.isPopped = true       

        // Allow some time to let the browser handle some events (e.g. label > update checkbox)
        setTimeout(() => {
            // set isPopped to false again, to force pop
            this.isPopped = false;
            this.pop(popParents);
        }, 80)
    }

    pop(popParents = false) {
        if (this.isPopped || this.hide) {
            // Ignore
            return
        }
        this.isPopped = true
        this.popChildMenu();

        // Trigger hide animation
        this.hide = true;
        setTimeout(() => {
            (this as any).parentPop({force: true})
        }, 200);

        if (popParents && this.parentMenu) {
            this.parentMenu.pop(true)
        }
    }

    activated() {
        document.addEventListener("keydown", this.onKey);
    }

    deactivated() {
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        const key = event.key || event.keyCode;

        if (key === "Escape" || key === "Esc" || key === 27) {
            this.pop(true);
            event.preventDefault();
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.context-menu-container {
    position: fixed;
    z-index: 10000;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;

    // Allow dragging over the whole screen on touch devices
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;

    &.disableDismiss {
        pointer-events: none;

        > * {
            pointer-events: all;
        }
    }

    &.hasParent {
        pointer-events: none;

        .context-menu {
            pointer-events: auto;
        }
    }

    .context-menu {
        transform-origin: 0% 0%;
        transition: transform 0.2s;


        &.top {
            transform-origin: 0% 100%;
        }

        &.left {
            transform-origin: 100% 0%;

            &.top {
                transform-origin: 100% 100%;
            }
        }

        
    }

    &.show-enter-active,
    &.show-leave-active {
        transition: opacity 0.2s;
    }

    &.show-enter-from /* .fade-leave-active below version 2.1.8 */ {
        // Instant appearing context menu! (only leave animation)
        opacity: 0;

        .context-menu {
            transform: scale(0.8, 0.8);
        }
    }

    &.show-leave-to /* .fade-leave-active below version 2.1.8 */ {
        // Instant appearing context menu! (only leave animation)
        opacity: 0;

        .context-menu {
            transform: scale(0.8, 0.8);
        }
    }

    .triangle {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        top: 0;
        background: red;
        opacity: 0.5;
        pointer-events: none;
        z-index: 100000;
    }
}

.context-menu {
    position: fixed;
    z-index: 10000;

    background: $color-background-shade-darker;
    
    --color-current-background: #{$color-background-shade-darker};
    --color-current-background-shade: #{$color-border};

    border: $border-width-thin solid $color-border-shade;
    padding: 6px 15px;

    @extend .style-overlay-shadow;
    border-radius: $border-radius-modals;
    box-sizing: border-box;
    min-width: 200px;

    @media (max-width: 450px) {
        min-width: 70vw;
    }

    max-width: 100vw;
    max-width: calc(100vw - 30px);
    overflow: hidden;
    overflow-y: auto;

    // Hide carret in element below the context menu
    transform: translate3d(0, 0, 0);

    .context-menu-item {
        @extend .style-context-menu-item;
        cursor: pointer;
        user-select: none;
        touch-action: manipulation;
        display: flex;
        flex-direction: row;
        align-items: center;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        min-height: 32px;
        margin: 0 -9px;
        padding: 0 9px;
        border-radius: $border-radius;

        // Fix for button width
        width: 100%;
        text-align: left;
        box-sizing: content-box;

        @media (max-width: 450px) {
            min-height: 38px;
        }

        &.with-description {
            min-height: 42px;
        }

        .description {
            @extend .style-context-menu-item-description;
            padding-top: 3px;
        }

        > .left {
            &:empty {
                display: none;
            }
            flex-shrink: 0;
            padding-right: 10px;
        }

        > .middle {
            padding: 2px 0;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .icon:not(.arrow-right-small):not(.arrow-down-small):not(.arrow-up-small) {
            width: 20px;
            height: 20px;
            font-size: 20px;

            &:before {
                font-size: 20px; 
            }
        }

        > .right {
            &:empty {
                display: none;
            }
            margin-left: auto;
            flex-shrink: 0;
            padding-left: 20px;
        }

        /** Note we use a class, because :disabled also disables hover events */
        &.disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }

        &:not(.disabled) {
            &.isOpen {
                background: $color-gray-2;
            }

            &.hover {
                background: $color-primary;
                color: $color-primary-contrast;
            }

            &:active:not(.disable-active) {
                background: $color-primary;
                color: $color-primary-contrast;
            }
        }
    }

    .context-menu-line {
        background: $color-border-shade;
        border: 0;
        outline: 0;
        border-radius: $border-width-thin;
        height: $border-width-thin;
        margin: 6px 0;

        @media (max-width: 450px) {
            margin: 6px 0;
        }
    }
}
</style>
