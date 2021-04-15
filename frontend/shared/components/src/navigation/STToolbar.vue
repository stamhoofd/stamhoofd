<template>
    <div class="st-toolbar" :class="{ sticky }">
        <div>
            <div>
                <slot name="left" />
            </div>
            <div>
                <slot name="right" />
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class STToolbar extends Vue {
    /**
     * Set sticky to false if a user is required to scroll down before completing a flow (this removes the unneeded CTA in the middle of the flow).
     */
    @Prop({ default: true })
    sticky!: boolean
}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use '~@stamhoofd/scss/base/text-styles.scss';

.st-toolbar {
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    margin-bottom: calc(-1 * var(--st-vertical-padding, 40px));
    margin-bottom: calc(-1 * var(--st-vertical-padding, 40px) - var(--st-safe-area-bottom, 0px));
    padding-top: var(--st-vertical-padding, 20px);
    bottom: 0;
    overflow: hidden;
    pointer-events: none; // fix browser bug not able to click through

    &.sticky {
        position: sticky;
    }

    > div {
        padding: 10px var(--st-horizontal-padding, 40px);
        padding-bottom: calc(var(--st-safe-area-bottom, 0px) + 10px);
        background: $color-white;
        border-top: $border-width solid $color-white-shade;
        display: flex;
        align-items: center;
        justify-content: space-between;
        pointer-events: all;

        > div:first-child {
            @extend .style-description;
            min-width: 0;
        }

        > div:last-child {
            flex-shrink: 0;
            display: flex;
            flex-direction: row;
            align-items: stretch;
            min-width: 0;
        }

        > div .button {
            margin-left: 10px;
        }

        @media (max-width: 500px) {
            > div:first-child {
                display: none;
            }

            > div .button, > div .loading-button {
                margin-left: 0;
                margin-right: 0;
                margin-top: 10px;

                &:first-child {
                    margin-top: 0;
                }
            }

            > div:last-child {
                flex-basis: 100%;
                flex-direction: column;

                &> .button {
                    width: 100%;
                    box-sizing: border-box;
                    justify-content: center;
                }
            }
        }
    }
}
</style>
