<template>
    <div class="st-toolbar sticky">
        <div :class="{ 'wrapped': wrapped }">
            <div>
                <slot name="left" />
            </div>
            <div ref="rightElement">
                <slot name="right" />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, useTemplateRef } from 'vue';
import { useHideTabBar } from '../containers/TabBarController.vue';
import { useResizeObserver } from '../inputs/hooks/useResizeObserver';

useHideTabBar();

const rightElement = useTemplateRef<HTMLElement>('rightElement');
const wrapped = ref(false);

onMounted(() => {
    updateSize();
});

useResizeObserver(rightElement, () => {
    updateSize();
});

function updateSize() {
    // if rightElement height is wrapped, set wrapped to true
    if (rightElement.value) {
        const rect = rightElement.value.getBoundingClientRect();
        if (rect.height > 60) {
            // Never go back to false
            wrapped.value = true;
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

@mixin center {
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
        max-width: 400px;
        margin: 0 auto;
        width: 100%;

        &> .button {
            width: 100%;
            box-sizing: border-box;
        }
    }
}

.st-toolbar {
    margin: 0;
    margin-bottom: calc(-1 * var(--st-vertical-padding, 40px));
    margin-bottom: calc(-1 * var(--st-vertical-padding, 40px) - var(--st-safe-area-bottom, 0px));
    padding-top: var(--st-vertical-padding, 20px);
    bottom: 0;
    overflow: hidden;
    z-index: 100;
    //pointer-events: none; // fix browser bug not able to click through

    // If embedded inside of a box: add negative margins around
    .box > & {
        margin-left: calc(-1 * var(--st-horizontal-padding, 20px));
        margin-right: calc(-1 * var(--st-horizontal-padding, 20px));
    }

        &.center {
        > div {
            @include center;
        }
    }

    > div {
        padding: 10px var(--st-horizontal-padding, 40px);
        --default-footer-padding: 10px;

        padding-bottom: calc(var(--st-safe-area-bottom, 0px) + 10px);
        background: $color-current-background;
        border-top: $border-width-thin solid $color-border;
        display: grid;
        grid-template-columns: 1fr auto;

        > div:first-child {
            @extend .style-description;
            min-width: 0;

            // Align this item vertically centered in the grid container
            align-self: center;
        }

        > div:last-child {
            display: flex;
            flex-direction: row;
            align-items: stretch;
            min-width: 0;
            gap: 7px;
            row-gap: 7px; // When wrapping, leave some margin
            flex-wrap: wrap;
            justify-content: flex-end;
        }

        &.wrapped {
            > div:first-child {
                display: none;
            }

            display: grid;
            grid-template-columns: 1fr;

            flex-direction: column;
            align-items: stretch;
            justify-content: stretch;

            > div:last-child {
                flex-grow: 1;
                flex-direction: column;
                align-items: stretch;
                justify-content: stretch;
            }
        }

        @media (max-width: 350px) {
            > div:first-child {
                display: none;
            }

            display: grid;
            grid-template-columns: 1fr;

            flex-direction: column;
            align-items: stretch;
            justify-content: stretch;

            > div:last-child {
                flex-grow: 1;
                flex-direction: column;
                align-items: stretch;
                justify-content: stretch;
            }
        }
    }
}
</style>
