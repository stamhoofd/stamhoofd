<template>
    <div class="st-toolbar sticky" :class="{ phone: $isPhone }">
        <div :class="{ 'wrapped': wrapped, 'has-left': hasLeft }">
            <div ref="leftElement">
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

const leftElement = useTemplateRef<HTMLElement>('leftElement');
const rightElement = useTemplateRef<HTMLElement>('rightElement');
const wrapped = ref(false);
const hasLeft = ref(true);

onMounted(() => {
    updateSize();
});

useResizeObserver(rightElement, () => {
    updateSize();
});

useResizeObserver(leftElement, () => {
    updateSize();
});

function updateSize() {
    if (leftElement.value) {
        hasLeft.value = leftElement.value.children.length > 0 || !!leftElement.value.textContent?.trim();
    }

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

// Buttons (except text buttons) take up the full width of the toolbar when stacked
@mixin full-width-buttons {
    > .loading-button {
        max-width: none;

        .button:not(.text) {
            width: 100%;
        }
    }
}

// A single button fills the toolbar
@mixin single-full-width-button {
    grid-template-columns: 1fr;

    > div:first-child {
        display: none;
    }

    > div:last-child {
        @include full-width-buttons;

        > .button:not(.text), > .loading-button {
            flex-grow: 1;
        }
    }
}

@mixin stacked {
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
        flex-direction: var(--st-toolbar-wrapped-direction);
        align-items: stretch;
        justify-content: stretch;

        > .button.text {
            margin: 0;
        }

        @include full-width-buttons;
    }
}

@mixin end-aligned {
    --st-toolbar-columns: 1fr auto;
    --st-toolbar-left-order: 0;
    --st-toolbar-left-align: left;
    --st-toolbar-direction: row;
    --st-toolbar-wrapped-direction: column;
    --st-toolbar-text-button-margin-left: 0px;
    --st-toolbar-text-button-margin-right: 13px;
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

    // Buttons align left, with the primary (last) button first. The left slot moves to the right.
    --st-toolbar-columns: auto 1fr;
    --st-toolbar-left-order: 1;
    --st-toolbar-left-align: right;
    --st-toolbar-direction: row-reverse;
    --st-toolbar-wrapped-direction: column-reverse;
    --st-toolbar-text-button-margin-left: 13px;
    --st-toolbar-text-button-margin-right: 0px;

    // Modals and mobile keep the buttons on the right, with the primary (last) button at the far right
    :where(.modal, .modal-full-height, .modal-dynamic-size, .popup, .sheet, .positionable-sheet) & {
        @include end-aligned;
    }

    // Phones are detected by device, because they are wider than 600px in landscape or when unfolded
    &.phone {
        @include end-aligned;
    }

    @media (max-width: 600px) {
        @include end-aligned;
    }

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
        padding: 8px var(--st-horizontal-padding, 40px);
        --default-footer-padding: 10px;

        padding-bottom: calc(var(--st-safe-area-bottom, 0px) + 10px);
        background: $color-current-background;
        border-top: $border-width-thin solid $color-border-lighter;
        display: grid;
        grid-template-columns: var(--st-toolbar-columns);

        > div:first-child {
            @extend %style-description;
            min-width: 0;
            order: var(--st-toolbar-left-order);
            text-align: var(--st-toolbar-left-align);

            // Align this item vertically centered in the grid container
            align-self: center;
        }

        > div:last-child {
            display: flex;
            flex-direction: var(--st-toolbar-direction);
            align-items: stretch;
            min-width: 0;
            gap: 7px;
            row-gap: 7px; // When wrapping, leave some margin
            flex-wrap: wrap;
            justify-content: flex-end;

            // Text buttons have no padding and a fixed height: center them and keep them away from the next button
            > .button.text {
                align-self: center;
                margin-left: var(--st-toolbar-text-button-margin-left);
                margin-right: var(--st-toolbar-text-button-margin-right);

                &:last-child {
                    margin: 0;
                }
            }
        }

        &.wrapped {
            @include stacked;
        }

        @media (max-width: 600px) {
            // On phones, multiple buttons are always placed below each other
            &:has(> div:last-child > :nth-child(2)) {
                @include stacked;
            }

            // A single button fills the toolbar when there is nothing on the left
            &:not(.has-left) {
                @include single-full-width-button;
            }
        }

        // Same in sheets and small views, but only for a single button
        &:not(.has-left):not(:has(> div:last-child > :nth-child(2))) {
            .sheet &, :where(.st-view.small, .st-view:has(> main.small)) > & {
                @include single-full-width-button;
            }
        }

        @media (max-width: 350px) {
            @include stacked;
        }
    }
}
</style>
