<template>
    <transition appear name="show">
        <div class="context-menu-container" @click="pop">
            <div
                ref="context"
                oncontextmenu="return false;"
                class="context-menu"
                :style="{ top: top + 'px', left: left + 'px' }"
                @click.stop=""
            >
                <slot></slot>
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

@Component
export default class ContextMenu extends Vue {
    @Prop({
        default: 0
    })
    x!: number;

    @Prop({
        default: 0
    })
    y!: number;

    top: number = 0;
    left: number = 0;

    mounted() {
        // Calculate position
        var width = (this.$refs.context as HTMLElement).offsetWidth;
        var height = (this.$refs.context as HTMLElement).offsetHeight;

        var viewPadding = 15;

        var win = window,
            doc = document,
            docElem = doc.documentElement,
            body = doc.getElementsByTagName("body")[0],
            clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
            clientHeight = win.innerHeight || docElem.clientHeight || body.clientHeight;

        this.left = this.x - Math.max(0, width - (clientWidth - viewPadding - this.x));
        this.top = this.y - Math.max(0, height - (clientHeight - viewPadding - this.y));

        this.$el.addEventListener("contextmenu", this.pop, { passive: true });
    }

    beforeDestroy() {
        this.$el.removeEventListener("contextmenu", this.pop);
    }

    pop() {
        console.log("pop");
        this.$parent.$parent.$emit("pop");
    }
}
</script>

<style lang="scss">
@use '~scss/base/text-styles.scss';

.context-menu-container {
    position: fixed;
    z-index: 10000;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;

    &.show-enter-active,
    &.show-leave-active {
        transition: opacity 0.2s;
    }
    &.show-leave-to /* .fade-leave-active below version 2.1.8 */ {
        // Instant appearing context menu! (only leave animation)
        opacity: 0;
    }
}
.context-menu {
    position: fixed;
    z-index: 10000;
    left: 0;
    top: 0;
    background: $color-dark;
    padding: 8px 0;
    border-radius: $border-radius;
    @extend .style-description;
    @extend .style-overlay-shadow;
    color: $color-white;
    box-sizing: border-box;
    min-width: 200px;
    max-width: 100vw;
    max-width: calc(100vw - 30px);

    .context-menu-item {
        @extend .style-context-menu-item;
        padding: 5px 20px;
        cursor: default;
        user-select: none;

        &:hover {
            background: $color-primary;
        }

        &.clicked {
            background: transparent;
        }
    }

    .context-menu-line {
        background: $color-white;
        opacity: 0.2;
        border: 0;
        outline: 0;
        border-radius: $border-width/2;
        height: $border-width;
        margin: 8px 0;
    }
}
</style>
