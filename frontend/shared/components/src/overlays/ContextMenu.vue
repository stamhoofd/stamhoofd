<template>
    <transition appear name="show">
        <div class="context-menu-container" :class="{ hasParent: !!parentMenu }" @click="pop" @contextmenu.prevent="pop">
            <div
                ref="context"
                class="context-menu"
                :class="usedXPlacement+' '+usedYPlacement"
                :style="{ transformOrigin, top: top ? top + 'px' : undefined, left: left ? (left + 'px') : undefined, right: right ? (right + 'px') : undefined, bottom: bottom ? (bottom + 'px') : undefined, width: preferredWidth ? (preferredWidth + 'px') : undefined }"
                @click.stop=""
            >
                <slot />
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
})
export default class ContextMenu extends Vue {
    @Prop({
        default: 0,
    })
    x!: number;

    @Prop({
        default: null,
    })
    preferredWidth!: number | null;

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
    parentMenu!: ContextMenu | null;

    /**
     * In case a placement is not possible, instead of just swapping xPlacement, also affect the x position first with the wrapWidth (needed for e.g. context menu's)
     */
    @Prop({
        default: null,
    })
    wrapWidth!: number | null

    isPopped = false

    mounted() {
        // Calculate position
        const width = (this.$refs.context as HTMLElement).offsetWidth;
        const height = (this.$refs.context as HTMLElement).offsetHeight;

        const viewPadding = 15;

        const win = window,
            doc = document,
            docElem = doc.documentElement,
            body = doc.getElementsByTagName("body")[0],
            clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
            clientHeight = win.innerHeight || docElem.clientHeight || body.clientHeight;

        if (this.xPlacement === "right") {
            this.left = this.x; 
            
            // If the remaining space is too small, we need to wrap
            if (width > clientWidth - viewPadding - this.x) {
                this.left = null
                this.usedXPlacement = "left"

                if (this.wrapWidth !== null) {
                    // Wrap instead of sticking to right
                    this.x = this.x - this.wrapWidth
                    this.right = Math.min(clientWidth - this.x, clientWidth - viewPadding - width);

                    if (this.right < viewPadding) {
                        this.right = viewPadding
                    }
                } else {
                    this.right = clientWidth - viewPadding
                }
            } else {
                if (this.left < viewPadding) {
                    this.left = viewPadding
                }
            }
            //- Math.max(0, width - (clientWidth - viewPadding - this.x));

        } else {
            this.right = Math.min(clientWidth - this.x, clientWidth - viewPadding - width)

            if (this.right < viewPadding) {
                this.right = viewPadding
            }
        }

        if (this.yPlacement === "bottom") {
            this.top = this.y - Math.max(0, height - (clientHeight - viewPadding - this.y)); // remove border
        } else {
            this.bottom = Math.min(clientHeight - this.y, clientHeight - viewPadding - height); // remove border
        }

        const objLeft = this.left ? this.left : (clientWidth - this.right! - width)
        const xTransform = ((this.x - objLeft) / width * 100).toFixed(2)

        const objTop = this.top ? this.top : (clientHeight - this.right! - height)
        const yTransform = ((this.y - objTop) / height * 100).toFixed(2)

        this.transformOrigin = xTransform + "% "+yTransform+"%"
        
        window.addEventListener("touchmove", this.onTouchMove, { passive: false });
        window.addEventListener("touchend", this.onTouchUp, { passive: false });

        if (this.isPopped || this.parentMenu?.isPopped || (this.parentMenu && (!this.parentMenu.$el || !this.parentMenu.$el.isConnected))) {
            // Pop was dismissed before we could mount this context menu
            console.error("Context menu lost its parent menu during mounting")
            this.pop(false)
        }
    }

    childMenu: ComponentWithProperties | null = null

    popChildMenu() {
        if (this.childMenu) {
            const instance =  this.childMenu.componentInstance() as any

            if (instance) {
                instance.$children[0].pop(false)
            } else {
                console.warn("Could not pop child menu, because it is not yet mounted")
            }
        }
        this.childMenu = null
    }

    setChildMenu(component: ComponentWithProperties | null) {
        if (this.childMenu === component) {
            return
        }
        this.popChildMenu()
        this.childMenu = component;
    }

    getSelectedElement(event): HTMLElement | null {
        // Check which one is hovered, and manually add a hover state to it
        let selectedElement = document.elementFromPoint(event.changedTouches[0].clientX, event.changedTouches[0].clientY);

        // Get parent until class is context-menu-item or stop when parent is document, or context-menu-container class
        while (selectedElement && !selectedElement.classList.contains("context-menu-item") && !selectedElement.classList.contains("context-menu-container")) {
            selectedElement = selectedElement.parentElement;
        }
        if (selectedElement && selectedElement.classList.contains("context-menu-item")) {
            return selectedElement as HTMLElement
        }
        return null
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
        const selectedElement = this.getSelectedElement(event);
        if (selectedElement) {
            selectedElement.click()
        }
    }

    beforeDestroy() {
        this.popChildMenu()
        window.removeEventListener("touchmove", this.onTouchMove);
        window.removeEventListener("touchend", this.onTouchUp);
    }

    pop(popParents = false) {
        this.isPopped = true
        this.popChildMenu()
        this.$parent.$parent.$emit("pop");

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
            this.pop();
            event.preventDefault();
        }
    }
}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use '~@stamhoofd/scss/base/text-styles.scss';

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

    &.show-enter /* .fade-leave-active below version 2.1.8 */ {
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
            min-height: 40px;
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
        }

        .icon {
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

        &:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }

        &:not(:disabled) {
            &.isOpen {
                background: $color-gray-2;
            }

            @media (hover: hover) {
                &:hover {
                    background: $color-primary;
                    color: $color-white;
                }
            }

            &.hover {
                background: $color-primary;
                color: $color-white;
            }

            &:active:not(.disable-active) {
                background: $color-primary;
                color: $color-white;
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
    }
}
</style>
