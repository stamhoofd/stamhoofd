<template>
    <transition appear name="show">
        <div class="tooltip" :style="{ top: top + 'px', left: left + 'px' }" :class="icon" @click="$parent.$emit('pop')">
            <span v-if="icon" :class="'icon '+icon" />
            <span>{{ text }}</span>
        </div>
    </transition>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class Tooltip extends Vue {
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

    top = 0;
    left = 0;

    mounted() {
        // Calculate position
        const width = (this.$el as HTMLElement).offsetWidth;
        const height = (this.$el as HTMLElement).offsetHeight;

        const viewPadding = 15;

        const win = window,
            doc = document,
            docElem = doc.documentElement,
            body = doc.getElementsByTagName("body")[0],
            clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
            clientHeight = win.innerHeight || docElem.clientHeight || body.clientHeight;

        this.left = this.x - Math.max(0, width - (clientWidth - viewPadding - this.x));
        this.top = this.y - Math.max(0, height - (clientHeight - viewPadding - this.y));

        // Hide on scroll or any touch
        document.addEventListener("touchstart", this.hide, { passive: true })
        document.addEventListener("pointerdown", this.hide, { passive: true })
        document.addEventListener("wheel", this.hide, { passive: true })
    }

    beforeDestroy() {
        document.removeEventListener("touchstart", this.hide)
        document.removeEventListener("pointerdown", this.hide)
        document.removeEventListener("wheel", this.hide)
    }

    hide() {
        this.$parent.$emit("pop")
    }
}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use '~@stamhoofd/scss/base/text-styles.scss';

.tooltip {
    position: fixed;
    z-index: 10000;
    left: 0;
    top: 0;
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

    @media (max-width: 350px + 30px) {
        max-width: 100vw;
        max-width: calc(100vw - 30px);
    }

    &.show-enter-active,
    &.show-leave-active {
        transition: opacity 0.2s, transform 0.2s;
    }
    &.show-enter, &.show-leave-to /* .fade-leave-active below version 2.1.8 */ {
        opacity: 0;
        transform: translate(0, 20px);
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
