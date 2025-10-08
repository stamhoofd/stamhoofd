<template>
    <STErrorsInput :error-fields="errorFields" :error-box="errorBox" class="st-input-box" :class="{indent}">
        <h4 :style="{display: title ? 'flex' : 'none'}">
            <label>{{ title }}</label>
            <div class="right">
                <slot name="right" />
            </div>
        </h4>
        <div :class="{'without-title': !title}">
            <slot />
        </div>
    </STErrorsInput>
</template>

<script lang="ts">
import { Component, Prop,Vue } from "vue-property-decorator";

import { ErrorBox } from '../errors/ErrorBox';
import STErrorsInput from '../errors/STErrorsInput.vue';
import { ViewportHelper } from "../ViewportHelper";

@Component({
    components: {
        STErrorsInput
    }
})
export default class STInputBox extends Vue {
    @Prop({ default: ""}) errorFields: string;
    @Prop({ default: null }) errorBox: ErrorBox | null;

    @Prop({ default: false})
        indent!: boolean

    @Prop({ default: ""})
        title!: string

    mounted() {
        if ((this as any).$isMobile) {
            this.$nextTick(() => {
                const inputElements = this.$el.querySelectorAll('input, textarea, select')
                inputElements.forEach((element) => {
                    element.addEventListener('focus', () => {
                        setTimeout(() => {
                            this.scrollIntoView(element as HTMLElement)
                        }, 300) // wait for possible keyboard animation
                    })
                })
            })
        }
    }

    scrollIntoView(element: HTMLElement) {
        // default scrollIntoView is broken on Safari and sometimes causes the scrollview to scroll too far and get stuck
        const scrollElement = ViewportHelper.getScrollElement(element)
        const elRect = element.getBoundingClientRect()
        const scrollRect = scrollElement.getBoundingClientRect()

        let scrollPosition = scrollElement.scrollTop + (elRect.top - scrollRect.top) - scrollElement.clientHeight / 4;
        // TODO: add the bottom padding of scrollRect as an extra offset (e.g. for the keyboard of st-view)
        console.log("innitial scrolling to", scrollPosition, "from", scrollElement.scrollTop, "diff", Math.abs(element.scrollTop - scrollPosition))

        let topPadding = parseInt(window.getComputedStyle(scrollElement, null).getPropertyValue('padding-top'))
        if (isNaN(topPadding)) {
            topPadding = 25
        }
        let elTopPadding = parseInt(window.getComputedStyle(element, null).getPropertyValue('padding-top'))
        if (isNaN(elTopPadding)) {
            elTopPadding = 0
        }
        scrollPosition -= Math.max(0, topPadding - elTopPadding)
        scrollPosition = Math.max(0, Math.min(scrollPosition, scrollElement.scrollHeight - scrollElement.clientHeight))

        const exponential = function(x: number): number {
            return x === 1 ? 1 : 1 - Math.pow(1.5, -20 * x);
        }

        console.log("Scrolling to", scrollPosition, "from", scrollElement.scrollTop, "diff", Math.abs(element.scrollTop - scrollPosition))

        ViewportHelper.scrollTo(scrollElement, scrollPosition, Math.min(600, Math.max(350, Math.abs(element.scrollTop - scrollPosition) / 2)), exponential)
    }
}
</script>


<style lang="scss">
@use '@stamhoofd/scss/base/text-styles.scss';

.st-input-box {
    padding: 10px 0;
    display: block;

    > div {
        max-width: 340px;

        @media (max-width: 500px) {
            max-width: none;
        }
    }

    > h4:has(.button) {
        max-width: 340px;

        @media (max-width: 500px) {
            max-width: none;
        }
    }

    &.max > div {
        max-width: none;
    }

    &.max > h4 {
        max-width: none;
    }

    &:has(.st-list) {
        padding-bottom: 5px;
    }

    & + .style-description-small, & + .style-description, + div:not([class]) > .style-description-small:first-child {
        margin-top: -5px;
        padding-bottom: 15px;
    }

    &.indent {
        padding-left: 35px;

        @media (max-width: 450px) {
            padding-left: 0;
        }
    }

    &.custom-bottom-box {
        padding-bottom: 0;
    }

    &.no-padding {
        // Keep 5px padding at bottom to compensate height of label
        padding: 0 0 5px 0;
    }

    > h4 {
        margin: 0;
        @extend .style-label;
        display: flex;
        flex-direction: row;
        align-items: center;
        // height: 24px;

        > label {
            flex-grow: 1; // fix safari newline glitch
            min-width: 0;
            /*overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;*/
            align-self: flex-start;
        }

        > .right {
            margin-left: auto;
            flex-shrink: 0;
            align-self: flex-end;
            height: 24px;

            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 7px;
        }
    }

    > h4 + div {
        > * {
            margin-top: 8px;
        }

        > *:first-child {
            margin-top: 6px;

            &.st-list {
                margin-top: 2px; // list
            }
        }

        &.without-title {
            > *:first-child {
                margin-top: 0;
            }
        }
    }
}
</style>
