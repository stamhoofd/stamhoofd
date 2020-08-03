<template>
    <STErrorsInput :error-fields="errorFields" :error-box="errorBox" class="st-input-box">
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

    > h4 {
        margin: 0;
        @extend .style-title-small;
        display: flex;
        flex-direction: row;
        align-items: center;
        height: 34px;

        > .right {
            margin-left: auto;
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