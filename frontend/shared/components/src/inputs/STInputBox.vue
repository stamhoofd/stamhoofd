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
import { Component, Prop,Vue } from "vue-property-decorator";

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
@use '~@stamhoofd/scss/base/text-styles.scss';

.st-input-box {
    padding: 12px 0;
    display: block;
    max-width: 340px;

    @media (max-width: 450px) {
        max-width: none;
    }

    &.indent {
        padding-left: 35px;

        @media (max-width: 450px) {
            padding-left: 0;
        }
    }

    &.no-padding {
        // Keep 5px padding at bottom to compensate height of label
        padding: 0 0 5px 0;
    }

    > h4 {
        margin: 0;
        @extend .style-title-small;
        display: flex;
        flex-direction: row;
        align-items: center;
        height: 34px;

        > label {
            flex-grow: 1; // fix safari newline glitch
            flex-shrink: 2;
        }

        > .right {
            margin-left: auto;
            flex-shrink: 1;
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