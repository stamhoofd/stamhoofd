<template>
    <transition appear name="show">
        <div class="context-menu-container" @click="pop">
            <div
                ref="context"
                oncontextmenu="return false;"
                class="context-menu"
                :class="xPlacement+' '+yPlacement"
                :style="{ transformOrigin, top: top ? top + 'px' : undefined, left: left ? (left + 'px') : undefined, right: right ? (right + 'px') : undefined, bottom: bottom ? (bottom + 'px') : undefined, width: preferredWidth ? (preferredWidth + 'px') : undefined }"
                @click.stop=""
            >
                <slot />
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
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
    xPlacement: "right" | "left";

    @Prop({
        default: "bottom",
    })
    yPlacement: "bottom" | "top";

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
            this.left = this.x - Math.max(0, width - (clientWidth - viewPadding - this.x));

            if (this.left < viewPadding) {
                this.left = viewPadding
            }

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
        
        this.$el.addEventListener("contextmenu", this.pop, { passive: true });
    }

    beforeDestroy() {
        this.$el.removeEventListener("contextmenu", this.pop);
    }

    pop() {
        this.$parent.$parent.$emit("pop");
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

    @media (max-width: 400px) {
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

        @media (max-width: 400px) {
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
        }

        > .right {
            &:empty {
                display: none;
            }
            margin-left: auto;
            flex-shrink: 0;
            padding-left: 20px;
        }


        &:hover {
            background: $color-primary;
            color: $color-white;

        }

        &.clicked {
            background: transparent;
            color: $color-dark;
        }
    }

    .context-menu-line {
        background: $color-border-shade;
        border: 0;
        outline: 0;
        border-radius: $border-width/2;
        height: $border-width;
        margin: 6px 0;
    }
}
</style>
