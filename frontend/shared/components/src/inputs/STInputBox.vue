<template>
    <STErrorsInput :error-fields="errorFields" :error-box="errorBox" class="st-input-box" :class="{indent}">
        <h4 v-if="title">
            <label>{{ title }}</label>
            <div class="right">
                <slot name="right" />
            </div>
        </h4>
        <slot />
    </STErrorsInput>
</template>


<script lang="ts">
import { Component, Prop,Vue } from "@simonbackx/vue-app-navigation/classes";

import { ErrorBox } from '../errors/ErrorBox';
import STErrorsInput from '../errors/STErrorsInput.vue';

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
}
</script>


<style lang="scss">
@use '@stamhoofd/scss/base/text-styles.scss';

.st-input-box {
    padding: 10px 0;
    display: block;
    max-width: 340px;

    @media (max-width: 450px) {
        max-width: none;
    }

    & + .style-description-small, & + .style-description {
        padding-bottom: 10px;
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
        height: 24px;

        > label {
            flex-grow: 1; // fix safari newline glitch
            min-width: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            align-self: flex-start;
        }

        > .right {
            margin-left: auto;
            flex-shrink: 0;
            align-self: flex-end;
        }

        ~ * {
            margin-top: 8px;

            &:last-child {
                margin-top: 0; // error box
            }
        }

        + * {
            margin-top: 0;
        }
    }

    &.max {
        max-width: none;
    }
}
</style>