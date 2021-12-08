<template>
    <div class="st-navigation-bar" :class="{ scrolled, sticky, large, fixed, 'show-title': showTitle, 'no-title': title.length == 0 }">
        <div>
            <BackButton v-if="pop || (dismiss && $isAndroid)" @click="$parent.pop" />
            <slot name="left" />
        </div>

        <slot name="middle">
            <h1>
                {{ title }}
            </h1>
        </slot>

        <div>
            <slot name="right" />
            <button v-if="dismiss && $isIOS" class="button text" @click="$parent.dismiss">
                Sluiten
            </button>
            <button v-else-if="dismiss && !$isAndroid" class="button icon close gray" @click="$parent.dismiss" />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop,Vue } from "vue-property-decorator";

import BackButton from ".//BackButton.vue";

@Component({
    components: {
        BackButton
    }
})
export default class STNavigationBar extends Vue {
    @Prop({ default: "", type: String })
    title!: string;

    @Prop({ default: true, type: Boolean })
    sticky!: boolean;

    @Prop({ default: true, type: Boolean })
    addShadow!: boolean;

    /**
     * Also show the title when not scrolled
     */
    @Prop({ default: false, type: Boolean })
    showTitle!: boolean;

    @Prop({ default: false, type: Boolean })
    fixed!: boolean;

    @Prop({ default: false, type: Boolean })
    large!: boolean;

    /// Add dismiss button (location depending on the OS)
    @Prop({ default: false, type: Boolean })
    dismiss!: boolean;

    /// Add pop button (location depending on the OS)
    @Prop({ default: false, type: Boolean })
    pop!: boolean;

    scrolled = false;
    scrollElement!: HTMLElement | null;

    getScrollElement(element: HTMLElement | null = null): HTMLElement {
        // If we are in modern mode, always choose the main element, which is the next sibling
        if (document.body.className.indexOf("modern") > -1) {
            return this.$el.nextElementSibling as HTMLElement;
        }

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
        if (!this.addShadow) {
            return
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
        if (scroll > 20) {
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

.st-view > .st-navigation-bar.sticky {
    // Old sticky behaviour
    position: sticky;
    top: 0;
}

.st-navigation-bar {
    margin: 0;
    margin-top: calc(-1 * var(--st-vertical-padding, 20px) + var(--navigation-bar-margin, 10px) - var(--st-safe-area-top, 0px));
    padding: var(--st-safe-area-top, 0px) var(--navigation-bar-horizontal-padding, var(--st-horizontal-padding, 40px)) 0 var(--navigation-bar-horizontal-padding, var(--st-horizontal-padding, 40px));
    height: 60px;
    word-break: normal;

    &.large {
        height: 80px;
        margin-top: calc(-1 * var(--st-vertical-padding, 20px) - var(--st-safe-area-top, 0px));
        margin-bottom: 0px;
        padding: var(--st-safe-area-top, 0px) 20px 0 20px;

        @media (max-width: 450px) {
            padding: var(--st-safe-area-top, 0px) 15px 0 15px;
        }
    }
    -webkit-app-region: drag;

    &.fixed {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        margin: 0;
    }

    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
    background: var(--color-white, white);
    background: var(--color-current-background, white);
    transition: background-color 0.3s, border-color 0.3s;
    z-index: 200;

    body.web-android &, body.native-android & {
        // align left on android
        grid-template-columns: auto 1fr auto;
    }

    &.no-title {
        grid-template-columns: auto 1fr;

        & > div:first-child:empty + div {
            margin-left: -20px;
        }

        > h1 {
            display: none;
        }
    }

    > div {
        display: flex;
        flex-direction: row;
        align-items: center;

        &:first-child {
            &:empty {
                min-width: 0;
                + h1 {
                    margin-left: -10px;
                }
            }
            
            display: flex;
            flex-direction: row;

            align-items: center;
            justify-content: flex-start;

            > .button {
                margin: 0;
            }

            // Visually correct back button
            > .button.text:first-child > .icon.arrow-left:first-child {
                margin-left: -4px;
            }

            > .button.icon {
                &:last-child {
                    margin-right: -12px;
                }

                &:first-child {
                    margin-left: -12px;
                }
            }
        }

        &:last-child {
            justify-content: flex-end;

            display: flex;
            flex-direction: row;

            align-items: center;
            justify-content: flex-end;

            > .button {
                margin: 0;
            }

            > .button.icon {
                &:last-child {
                    margin-right: -12px;
                }

                &:first-child {
                    margin-left: -12px;
                }
            }
        }
    }

    &.wrap {
        height: auto;

        > div {
            &:last-child {
                flex-wrap: wrap;
                margin: -5px -10px;

                > * {
                    margin: 5px 10px;
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

    body.web-android &, body.native-android & {
        // Increase title size a bit
        > h1 {
            font-size: 16px;
        }
    }


    &.show-title {
        > h1 {
            opacity: 0.6;
        }
    }

    border-bottom: $border-width-thin solid transparent;
    
    // Fix for rendering rounding
    padding-bottom: $border-width-thin;

    &.scrolled {
        background: $color-background-shade;

        //box-shadow: 0px 2px 3px $color-shadow;
        border-color: $color-border-shade;
  
        > h1 {
            opacity: 1;
        }
    }
    
    // Other helper styles (need to revalidate)
    .input {
        width: 220px;
        display: inline-block;
        flex-shrink: 10000000;

        @media (max-width: 500px) {
            width: 100%;
            min-width: 150px;
        }
    }

    select.input {
        width: auto;
    }
}
</style>
