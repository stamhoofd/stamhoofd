<template>
    <div class="st-toolbar">
        <div>
            <slot name="left" />
        </div>
        <div>
            <slot name="right" />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class STToolbar extends Vue {}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use '~@stamhoofd/scss/layout/split-inputs.scss';
@use '~@stamhoofd/scss/base/text-styles.scss';

.st-toolbar {
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    padding: 10px var(--st-horizontal-padding, 40px);
    background: $color-white;
    position: sticky;
    bottom: 0;
    border-top: $border-width solid $color-white-shade;
    display: flex;
    align-items: center;
    justify-content: space-between;

    > div:first-child {
        @extend .style-description;
    }

    > div:last-child {
        flex-shrink: 0;
    }

    > div .button {
        margin-left: 10px;
    }
}
</style>
