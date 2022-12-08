<template>
    <div class="st-navigation-bar" :class="{ scrolled, sticky, large, fixed, 'show-title': showTitle}" :style="{'grid-template-columns': templateColumns}">
        <div v-if="hasLeft || hasRight" class="left">
            <BackButton v-if="pop" @click="$parent.pop" />
            <button v-else-if="dismiss && $isAndroid" class="button navigation icon close" type="button" @click="$parent.dismiss" />
            <slot name="left" />
        </div>

        <slot v-if="hasMiddle" name="middle">
            <h1>
                {{ title }}
            </h1>
        </slot>

        <div v-if="hasRight || hasRight" class="right">
            <slot name="right" />
            <button v-if="dismiss && $isIOS" class="button navigation" type="button" @click="$parent.dismiss">
                Sluiten
            </button>
            <button v-else-if="dismiss && !$isAndroid" class="button navigation icon close" type="button" @click="$parent.dismiss" />
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

    @Prop({ default: false, type: Boolean })
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

    $slots;

    get hasLeft() {
        return this.pop || (this.dismiss && (this as any).$isAndroid) || !!this.$slots['left']
    }

    get hasRight() {
        return (this.dismiss && !(this as any).$isAndroid) || !!this.$slots['right']
    }

    get hasMiddle() {
        return !!this.$slots['middle'] || this.title.length > 0
    }

    get templateColumns() {
        if (this.hasMiddle && (this.hasLeft || this.hasRight)) {
            if ((this as any).$isAndroid) {
                return "auto 1fr auto"
            }
            return "1fr auto 1fr"
        }

        if (!this.hasMiddle) {
            return "auto 1fr"
        }

        return "1fr"
    }


    getScrollElement(element: HTMLElement | null = null): HTMLElement {
        // If we are in modern mode, always choose the main element, which is the next sibling
        if (!this.sticky && document.body.className.indexOf("modern") > -1) {
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
        this.scrollElement = this.getScrollElement();
        if (this.scrollElement === document.documentElement) {
            window.addEventListener("scroll", this.onScroll, { passive: true });
        } else {
            this.scrollElement.addEventListener("scroll", this.onScroll, { passive: true });
        }
    }

    mounted() {
        this.addListener();
    }

    activated() {
        // fix for element not yet in dom
        window.setTimeout(() => {
            this.addListener();
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

    height: 56px;
    word-break: normal;

    @media (min-width: 550px) {
        padding-top: max(var(--st-safe-area-top, 0px), 5px);
        height: 55px;
    }

    body.native-iOS & {
        height: 42px; // 44px - 2 x border width thin
    }

    &.block-width {
        height: calc(var(--block-width, 45px) + 20px);
    }

    &.large {
        height: 80px;
        //margin-top: calc(-1 * var(--st-vertical-padding, 20px) - var(--st-safe-area-top, 0px));
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

    &.sticky {
        position: sticky;
        top: calc(-1 * var(--st-vertical-padding, 20px));
        margin-left: calc(-1 * var(--st-horizontal-padding, 20px));
        margin-right: calc(-1 * var(--st-horizontal-padding, 20px));
        margin-top: 0;
        padding-top: 0;
        margin-bottom: 10px;
        //margin-top: calc(-1 * var(--st-vertical-padding, 20px));
    }

    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    background: $color-background;
    background: var(--color-current-background, white);
    transition: background-color 0.3s, border-color 0.3s;
    z-index: 200;

    > div {
        display: flex;
        flex-direction: row;
        align-items: center;

        &.left{
            padding-right: 15px;

            &:empty, &.empty {
                min-width: 0;
                + h1 {
                    margin-left: -10px;
                }
                padding-right: 0px;;
            }
            
            display: flex;
            flex-direction: row;

            align-items: center;
            justify-content: flex-start;

            > .button {
                margin-left: 10px;
                margin-right: 10px;

                &:first-child {
                    margin-left: 0;
                }

                &:last-child {
                    margin-right: 0;
                }
            }
        }

        &.right {
            padding-left: 15px;
            &:empty, &.empty {
                min-width: 0;
                padding-left: 0px;;
            }

            justify-content: flex-end;

            display: flex;
            flex-direction: row;

            align-items: center;
            justify-content: flex-end;

            > .button {
                margin-left: 10px;
                margin-right: 10px;

                &:first-child {
                    margin-left: 0;
                }

                &:last-child {
                    margin-right: 0;
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

        text-align: center;

        body.web-android &, body.native-android & {
            text-align: left;
        }
    }

    body.web-android &, body.native-android & {
        // Increase title size a bit
        > h1 {
            font-size: 19px;
        }
    }

    body.web-iOS &, body.native-iOS & {
        // Increase title size a bit
        > h1 {
            font-size: 17px;
        }
    }


    &.show-title {
        > h1 {
            opacity: 1;
        }
    }

    border-bottom: $border-width-thin solid transparent;

    // also one at the top to fix centering
    border-top: $border-width-thin solid transparent;

    &.scrolled {
        background: $color-background-shade;

        //box-shadow: 0px 2px 3px $color-shadow;
        border-bottom-color: $color-border-shade;

        &.large, body.native-android &, body.web-android & {
            box-shadow: 0px 2px 5px $color-shadow;
            border-bottom-color: transparent;
        }
  
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
