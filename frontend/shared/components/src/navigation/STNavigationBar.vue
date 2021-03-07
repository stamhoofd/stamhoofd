<template>
    <div class="st-navigation-bar" :class="{ scrolled, sticky, large }">
        <div>
            <slot name="left" />
        </div>

        <slot name="middle">
            <h1>
                {{ title }}
            </h1>
        </slot>

        <div>
            <slot name="right" />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop,Vue } from "vue-property-decorator";

@Component
export default class STNavigationBar extends Vue {
    @Prop({ default: "", type: String })
    title!: string;

    @Prop({ default: true, type: Boolean })
    sticky!: boolean;

    @Prop({ default: false, type: Boolean })
    large!: boolean;

    scrolled = false;
    scrollElement!: HTMLElement | null;

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

    addListener() {
        if (this.scrollElement) {
            return;
        }
        this.scrollElement = this.getScrollElement();
        if (this.scrollElement === document.documentElement) {
            window.addEventListener("scroll", this.onScroll, { passive: true });
        } else {
            this.scrollElement.addEventListener("scroll", this.onScroll, { passive: true });
        }
    }

    mounted() {
        if (this.sticky) {
            this.addListener();
        }
    }

    activated() {
        // fix for element not yet in dom
        window.setTimeout(() => {
            if (this.sticky) {
                this.addListener();
            }
        }, 500);
    }

    deactivated() {
        if (!this.scrollElement) {
            return;
        }
        if (this.scrollElement === document.documentElement) {
            window.removeEventListener("scroll", this.onScroll);
        } else {
            this.scrollElement.removeEventListener("scroll", this.onScroll);
        }
        this.scrollElement = null;
    }

    onScroll() {
        const scroll = this.scrollElement!.scrollTop;
        if (scroll > 50) {
            this.scrolled = true;
        } else if (scroll < 15) {
            this.scrolled = false;
        }
    }
}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use '~@stamhoofd/scss/layout/split-inputs.scss';
@use '~@stamhoofd/scss/base/text-styles.scss';

.st-navigation-bar {
    // Todo: replace padding with variable padding
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    margin-top: calc(-1 * var(--st-vertical-padding, 20px) + 20px);
    padding: var(--st-safe-area-top, 0px) var(--st-horizontal-padding, 40px) 0 var(--st-horizontal-padding, 40px);
    height: 60px;

    &.large {
        height: 90px;
        margin-top: calc(-1 * var(--st-vertical-padding, 20px));
    }
    -webkit-app-region: drag;

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

        &:first-child {
            > * {
                margin: 0 10px;

                &:first-child {
                    margin-left: 0;
                }
            }
        }

        &:last-child {
            justify-content: flex-end;

            > * {
                margin: 0 10px;

                &:last-child {
                    margin-right: 0;
                }
            }
        }
    }

    > h1 {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
