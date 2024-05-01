<template>
    <transition appear name="show">
        <div 
            class="tooltip" 
            :class="usedXPlacement+' '+usedYPlacement+' '+icon"
            :style="{ transformOrigin, top: top !== null ? top + 'px' : undefined, left: left !== null ? (left + 'px') : undefined, right: right !== null ? (right + 'px') : undefined, bottom: bottom !== null ? (bottom + 'px') : undefined, width: usedPreferredWidth !== null ? (usedPreferredWidth + 'px') : undefined, height: usedPreferredHeight !== null ? (usedPreferredHeight + 'px') : undefined }"  
            @click="hide"
        >
            <span v-if="icon" :class="'icon '+icon" />
            <span>{{ text }}</span>
        </div>
    </transition>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Mixins } from "@simonbackx/vue-app-navigation/classes";
import { Component, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component
export default class Tooltip extends Mixins(NavigationMixin) {
    @Prop({
        default: "No tooltip text set",
    })
        text!: string;

    @Prop({
        default: null,
    })
        icon!: string | null;
    
    @Prop({
        default: 0,
    })
        x!: number;

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

    usedPreferredHeight: number | null = null;
    usedPreferredWidth: number | null = null;

    mounted() {
        // Calculate position
        let width = (this.$el as HTMLElement).offsetWidth;
        let height = (this.$el as HTMLElement).offsetHeight;

        const viewPadding = 15;

        const win = window,
            doc = document,
            docElem = doc.documentElement,
            body = doc.getElementsByTagName("body")[0],
            clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
            clientHeight = win.innerHeight || docElem.clientHeight || body.clientHeight;

        if (width > clientWidth - viewPadding * 2) {
            this.usedPreferredWidth = clientWidth - viewPadding * 2;
            width = clientWidth - viewPadding * 2;
        }

        if (height > clientHeight - viewPadding * 2) {
            this.usedPreferredHeight = clientHeight - viewPadding * 2;
            height = clientHeight - viewPadding * 2;
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
            if (height > clientHeight - viewPadding - this.y) {
                this.top = null
                this.usedYPlacement = "top"

                if (this.wrapHeight !== null) {
                    // Wrap instead of sticking to bottom
                    usedY = usedY - this.wrapHeight
                    this.bottom = Math.min(clientHeight - usedY, clientHeight - viewPadding - height);

                    if (this.bottom < viewPadding) {
                        this.bottom = viewPadding
                    }
                } else {
                    this.bottom = viewPadding
                }
            } else {
                if (this.top < viewPadding) {
                    this.top = viewPadding
                }
            }
        } else {
            this.bottom = Math.min(clientHeight - usedY, clientHeight - viewPadding - height); // remove border

            if (this.bottom < viewPadding) {
                this.bottom = viewPadding
            }
        }

        const objLeft = this.left ? this.left : (clientWidth - this.right! - width)
        const xTransform = ((usedX - objLeft) / width * 100).toFixed(2)

        const objTop = this.top ? this.top : (clientHeight - this.bottom! - height)
        const yTransform = ((usedY - objTop) / height * 100).toFixed(2)

        this.transformOrigin = xTransform + "% "+yTransform+"%"

        // Hide on scroll or any touch
        document.addEventListener("touchstart", this.hide, { passive: true })
        document.addEventListener("pointerdown", this.hide, { passive: true })
        document.addEventListener("wheel", this.hide, { passive: true })
    }

    beforeUnmount() {
        document.removeEventListener("touchstart", this.hide)
        document.removeEventListener("pointerdown", this.hide)
        document.removeEventListener("wheel", this.hide)
    }

    hide() {
        this.pop({force: true})
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.tooltip {
    position: fixed;
    z-index: 10000;
    @extend .style-context-menu-item;
    line-height: 1.5;
    @extend .style-overlay-shadow;
    box-sizing: border-box;
    max-width: 350px;

    background: $color-background-shade-darker;
    
    --color-current-background: #{$color-background-shade-darker};
    --color-current-background-shade: #{$color-border};

    border: $border-width-thin solid $color-border-shade;
    padding: 10px 15px;
    border-radius: $border-radius-modals;
    color: $color-dark;

    pointer-events: none;

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

    &.show-enter-active,
    &.show-leave-active {
        transition: opacity 0.2s, transform 0.2s;
    }
    &.show-enter-from, &.show-leave-to /* .fade-leave-active below version 2.1.8 */ {
        opacity: 0;
        transform: scale(0.8, 0.8);
    }

    > .icon {
        display: inline-block;
        margin: -10px 5px -10px 0;
        vertical-align: middle;
    }

    > span {
        display: inline-block;
        vertical-align: middle;
    }

    &.green {
        background-color: $color-success-background;
        color: $color-success-dark;

        .progress {
            background: $color-success;
        }
    }
}
</style>
