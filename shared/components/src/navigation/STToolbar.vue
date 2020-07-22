<template>
    <div class="st-toolbar">
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
import { Component, Vue } from "vue-property-decorator";

@Component
export default class STToolbar extends Vue {}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use '~@stamhoofd/scss/base/text-styles.scss';
@use '~@stamhoofd/scss/components/buttons.scss' as buttons;

.st-toolbar {
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    margin-bottom: calc(-1 * var(--st-vertical-padding, 40px));
    padding-top: var(--st-vertical-padding, 20px);
    position: sticky;
    bottom: 0;

    > div {
        padding: 10px var(--st-horizontal-padding, 40px);
        background: $color-white;
        border-top: $border-width solid $color-white-shade;
        display: flex;
        align-items: center;
        justify-content: space-between;

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

            > div .button {
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
                    @include buttons.center;
                }
            }
        }
    }
}
</style>
