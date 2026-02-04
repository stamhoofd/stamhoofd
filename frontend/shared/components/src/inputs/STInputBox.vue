<template>
    <STErrorsInput :error-fields="errorFields" :error-box="errorBox" class="st-input-box" :class="{indent, noTitle: !title}">
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
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

import { ErrorBox } from '../errors/ErrorBox';
import STErrorsInput from '../errors/STErrorsInput.vue';

@Component({
    components: {
        STErrorsInput,
    },
})
export default class STInputBox extends VueComponent {
    @Prop({ default: '' }) errorFields: string;
    @Prop({ default: null }) errorBox: ErrorBox | ErrorBox[] | null;

    @Prop({ default: false })
    indent!: boolean;

    @Prop({ default: '' })
    title!: string;
}
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/text-styles.scss';

.st-input-box {
    padding: 12px 0;
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

    h2 + &.noTitle  {
        padding-top: 5px;
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
            margin-top: 4px;

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
