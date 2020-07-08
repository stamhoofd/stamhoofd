<template>
    <div class="input-box">
        <h4>
            <label>{{ title }}</label>
            <div class="right">
                <slot name="right" />
            </div>
        </h4>
        <slot />
    </div>
</template>


<script lang="ts">
import { Component, Prop,Vue } from "vue-property-decorator";

@Component({

})
export default class InputBox extends Vue {
    @Prop({ default: ""})
    title!: string
}
</script>


<style lang="scss">
@use '~@stamhoofd/scss/base/text-styles.scss';

.input-box {
    padding: 8px 0;
    display: block;
    max-width: 500px;

    > h4 {
        margin: 0;
        padding-bottom: 8px;
        @extend .style-title-small;
        display: flex;
        flex-direction: row;
        align-items: center;

        > .right {
            margin-left: auto;
        }
    }
}
</style>