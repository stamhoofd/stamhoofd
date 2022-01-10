<template>
    <div class="st-button-toolbar">
        <div>
            <slot />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class STButtonToolbar extends Vue {
}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;

.st-button-toolbar {
    margin: 0;
    margin-bottom: calc(-1 * var(--st-vertical-padding, 40px));
    margin-bottom: calc(-1 * var(--st-vertical-padding, 40px) - var(--st-safe-area-bottom, 0px));
    padding-top: var(--st-vertical-padding, 20px);
    
    > div {
        flex-shrink: 0;
        height: 60px;
        box-sizing: content-box;
        border-top: $border-width-thin solid $color-border-shade;
        padding-bottom: var(--st-safe-area-bottom, 0px);

        margin: 0;

        background: $color-background-shade;

        display: flex;
        flex-direction: row;
        align-items: stretch;

        position: sticky;
        bottom: 0;
        
        > .button {
            flex-grow: 1;

            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: auto;
            line-height: 1;
            position: relative;
            overflow: visible;

            > span {
                margin-bottom: 4px;
            }

            &.is-active {
                color: $color-primary;
            }

            > .bubble {
                background: $color-error;
                position: absolute;
                left: 50%;
                top: 0;
                transform: translate(calc(12px - 20%), -20%);
            }
        }
    }
}
</style>
