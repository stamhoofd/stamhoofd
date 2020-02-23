<template>
    <div class="st-navigation-bar" :class="{ scrolled: scrolled, sticky: sticky }">
        <div>
            <slot name="left"></slot>
        </div>

        <h1>
            {{ title }}
        </h1>

        <div>
            <slot name="right"></slot>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

@Component
export default class STNavigationBar extends Vue {
    @Prop({ default: "", type: String })
    title!: string;

    @Prop({ default: true, type: Boolean })
    sticky!: boolean;

    scrolled: boolean = false;
    scrollElement!: HTMLElement;

    getScrollElement(element: HTMLElement | null = null): HTMLElement {
        if (!element) {
            element = this.$el as HTMLElement;
        }

        const style = window.getComputedStyle(element);
        if (
            style.overflowY == "scroll" ||
            style.overflow == "scroll" ||
            style.overflow == "auto" ||
            style.overflowY == "auto"
        ) {
            return element;
        } else {
            if (!element.parentElement) {
                return document.documentElement;
            }
            return this.getScrollElement(element.parentElement);
        }
    }

    deactivated() {
        if (this.scrollElement === document.documentElement) {
            window.removeEventListener("scroll", this.onScroll);
        } else {
            this.scrollElement.addEventListener("scroll", this.onScroll, { passive: true });
        }
    }

    activated() {
        if (this.sticky) {
            this.scrollElement = this.getScrollElement();
            if (this.scrollElement === document.documentElement) {
                window.addEventListener("scroll", this.onScroll, { passive: true });
            } else {
                this.scrollElement.addEventListener("scroll", this.onScroll, { passive: true });
            }
        }
    }

    onScroll() {
        let scroll = this.scrollElement.scrollTop;
        if (scroll > 50) {
            this.scrolled = true;
        } else if (scroll < 15) {
            this.scrolled = false;
        }
    }
}
</script>

<style lang="scss">
@use '~scss/layout/split-inputs.scss';
@use '~scss/base/text-styles.scss';

.st-navigation-bar {
    // Todo: replace padding with variable padding
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    padding: 0 var(--st-horizontal-padding, 40px);
    height: 70px;

    &.sticky {
        position: sticky;
        top: 0;
    }

    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
    background: white;
    z-index: 11;

    > div {
        display: flex;
        flex-direction: row;
        align-items: center;

        &:last-child {
            justify-content: flex-end;
        }
    }

    > h1 {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        word-wrap: none;
        opacity: 0;
        transition: opacity 0.2s;
        @extend .style-title-small;
    }

    &.scrolled {
        box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.05);
        > h1 {
            opacity: 1;
        }
    }

    // Other helper styles (need to revalidate)
    .input {
        width: 220px;
        display: inline-block;
        margin: 5px 5px;
    }

    select.input {
        width: auto;
    }
}
</style>
