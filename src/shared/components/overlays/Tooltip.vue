<template>
    <transition appear name="show">
        <div class="tooltip" :style="{ top: top + 'px', left: left + 'px' }">
            {{ text }}
        </div>
    </transition>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

@Component
export default class Checkbox extends Vue {
    @Prop({
        default: "No tooltip text set"
    })
    text!: string;

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
        var width = (this.$el as HTMLElement).offsetWidth;
        var height = (this.$el as HTMLElement).offsetHeight;

        var viewPadding = 15;

        var win = window,
            doc = document,
            docElem = doc.documentElement,
            body = doc.getElementsByTagName("body")[0],
            clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
            clientHeight = win.innerHeight || docElem.clientHeight || body.clientHeight;

        this.left = this.x - Math.max(0, width - (clientWidth - viewPadding - this.x));
        this.top = this.y - Math.max(0, height - (clientHeight - viewPadding - this.y));
    }
}
</script>

<style lang="scss">
@use '~scss/base/text-styles.scss';

.tooltip {
    position: fixed;
    z-index: 10000;
    left: 0;
    top: 0;
    background: $color-dark;
    padding: 15px;
    border-radius: $border-radius;
    @extend .style-description-small;
    @extend .style-overlay-shadow;
    color: $color-white;
    box-sizing: border-box;
    max-width: 350px;

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
}
</style>
