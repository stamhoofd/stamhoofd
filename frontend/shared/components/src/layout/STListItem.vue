<template>
    <component
        :is="dynamicElementName"
        class="st-list-item"
        :class="[{
            selectable,
            hoverable,
            disabled,
            button: dynamicElementName === 'button'
        }, $attrs.class]"
        :type="dynamicElementName === 'button' ? 'button' : undefined"
        v-bind="$attrs"
        @click="onClick"
        @contextmenu="$emit('contextmenu', $event)"
    >
        <div class="left">
            <slot name="left" />
        </div>
        <div class="main">
            <div>
                <div class="middle">
                    <slot />
                </div>
                <div class="right">
                    <slot name="right" />
                </div>
            </div>
            <hr>
        </div>
    </component>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue';

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(
    // props
    defineProps<{
        elementName?: string;
        selectable?: boolean;
        disabled?: boolean;
    }>(),
    // default values
    {
        elementName: 'article',
        selectable: false,
        disabled: false,
    },
);

const dynamicElementName = computed(() => (props.elementName === 'article' && props.selectable && !props.disabled) ? 'button' : props.elementName);
const hoverable = computed(() => dynamicElementName.value === 'button' || dynamicElementName.value === 'label');
const emit = defineEmits(['click', 'contextmenu']);
const instance = getCurrentInstance();

function onClick(event) {
    const isDragging = instance?.proxy?.$parent?.$parent?.$el?.className?.indexOf('is-dragging') >= 0;
    if (isDragging) {
        console.log('canceled list item click because of drag');
        return;
    }
    emit('click', event);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables" as *;
@use "@stamhoofd/scss/base/text-styles" as *;

a.st-list-item {
  &,
  &:hover,
  &:active,
  &:visited,
  &:link {
    color: inherit;
    text-decoration: inherit;
  }
}

button.st-list-item {
  text-align: inherit;
}

.st-list-item {
    --custom-st-horizontal-padding: max(15px, var(--st-horizontal-padding, 15px));
    --added-st-horizontal-padding: calc(var(--custom-st-horizontal-padding) - var(--st-horizontal-padding, 15px));
    padding-left: var(--st-horizontal-padding, 15px);
    padding-right: 0;
    padding-right: var(--st-horizontal-padding, 15px);
    margin: 0;
    display: flex !important;
    flex-direction: row;
    align-items: stretch;
    width: 100%; // fix for buttons
    box-sizing: border-box;
    contain: style;

    @extend .style-normal;

    &.selected {
        color: $color-primary;
    }

    > .left {
        flex-shrink: 0;

        padding-top: var(--st-list-padding-top, var(--st-list-padding, 15px));
        padding-right: 15px;
        padding-bottom: var(--st-list-padding-bottom, var(--st-list-padding, 15px));
        min-width: 0; // flexbox disable becoming bigger than parent

        &:empty {
            display: none;
        }
    }

    &.left-center {
        > .left {
            display: flex;
            flex-direction: row;
            align-items: center;
        }
    }

    &.right-small {
        > .main > div > .right {
            @extend .style-description-small;
            text-align: right;
            padding-left: 10px;
        }
    }

    &.right-top {
        > .main > div > .right {
            align-self: flex-start;
        }
    }

    &.right-description {
        > .main > div > .right {
            @extend .style-description;
            text-align: right;
            flex-shrink: 10;
            padding-left: 15px;
        }
    }

    &.right-price {
        > .main > div > .right {
            @extend .style-description;
            text-align: right;
            flex-shrink: 0;
            padding-left: 15px;
        }
    }

    &.right-description.wrap {
        > .main > div > .right {
            white-space: pre-wrap;
        }
    }

    &.right-stack {
        .right {
            display: flex;
            flex-direction: row;
            align-items: center;
            > * {
                margin: 0 5px;

                &:last-child {
                margin-right: 0;
                }

                &:first-child {
                margin-left: 0;
                }
            }

            > .button {
                margin: -5px 5px;

                &:last-child {
                margin-right: 0;
                }

                &:first-child {
                margin-left: 0;
                }
            }
        }

        &.no-margin {
            .right {
                > * {
                margin: 0;
                }

                > .button {
                margin: -5px 0;
                }
            }
        }
    }

    &.no-padding {
        > .main > div > .middle {
            padding: 0 !important;
        }

        > .main > div > .right {
            padding: 0 !important;
        }
    }

    > .main {
        flex-grow: 1;

        // Make sure the hr drops to the bottom if the left is longer
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-width: 0; // flexbox disable becoming bigger than parent

        > div {
            display: flex;
            flex-direction: row;
            align-items: center;
            flex-grow: 1;

            > .middle {
                padding-top: var(--st-list-padding-top, var(--st-list-padding, 15px));
                padding-bottom: var(--st-list-padding-bottom, var(--st-list-padding, 15px));
                flex-grow: 1;
                min-width: 0; // flexbox disable becoming bigger than parent
            }

            > .right {
                margin-left: auto;
                min-width: 0; // flexbox disable becoming bigger than parent
                flex-shrink: 0;

                padding-top: var(--st-list-padding-top, var(--st-list-padding, 15px));
                padding-bottom: var(--st-list-padding-bottom, var(--st-list-padding, 15px));
                padding-left: 15px;

                &:empty {
                display: none;
                }
            }
        }

        > hr {
            border: 0;
            outline: 0;
            height: $border-width-thin;
            width: 100%;
            background: $color-border;
            border-radius: $border-width-thin/2;
            margin: 0;
            margin-right: calc(-1 * var(--custom-st-horizontal-padding, 15px));
            z-index: -2;

            // Increase width + horizontal padding
            padding-right: var(--custom-st-horizontal-padding, 15px);
        }
    }

    // Wrap on smartphones (because content is too long)
    &.smartphone-wrap {
        @media (max-width: 450px) {
            > .main > div {
                display: block;

                > .middle {
                padding-right: var(--custom-st-horizontal-padding, 15px);
                padding-bottom: 0px;
                }

                > .right {
                padding-top: 5px;
                padding-bottom: 15px;
                }
            }
        }
    }

    &.smartphone-wrap-left {
        @media (max-width: 450px) {
            display: block !important;

            > .left {
                padding-top: var(--st-list-padding, 15px);
                padding-right: 0;
                padding-bottom: 0;
            }
        }
    }

    &.full-border {
        position: relative;

        > .main > hr {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
        }
    }

    &:last-child,
    &.no-border {
        > .main > hr {
            display: none;
        }
    }

    &.disabled {
        opacity: 0.5;
    }

    &.selectable:not(.is-dragging) {
        touch-action: manipulation;
        user-select: none;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        cursor: pointer;
        overflow: visible;
        position: relative;

        &:after {
            // This is the hover layer
            content: '';
            position: absolute;
            top: -1px;
            left: calc(-1 * var(--added-st-horizontal-padding, 0px));
            right: calc(-1 * var(--added-st-horizontal-padding, 0px));
            bottom: 1px;
            background: $color-primary-lighter;
            z-index: -3;
            opacity: 0;
            pointer-events: none;
            border-radius: min($border-radius, var(--added-st-horizontal-padding, 0px));

            transition: opacity 0.1s;
        }

        &:before {
            // This is the click layer
            content: '';
            position: absolute;
            top: -2px;
            left: calc(-1 * var(--added-st-horizontal-padding, 0px));
            right: calc(-1 * var(--added-st-horizontal-padding, 0px));
            bottom: -2px;
            background: $color-primary-light;
            z-index: -1;
            opacity: 0;
            pointer-events: none;
            border-radius: min($border-radius, var(--added-st-horizontal-padding, 0px));

            // Slow fade out
            transition: opacity 0.4s 0.1s;
        }

        &.hoverable:hover {
            &:after {
                opacity: 1;
                transition: none;
            }

            &:has(button:hover), &:has(select:hover), &:has(textarea:hover), &:has(input:not([type=radio]):not([type=checkbox]):hover), &:has(label:hover), &:has(.input:hover) {
                // Skip hover
                &:after {
                    opacity: 0;
                }
            }
        }

        &:active, &.hoverable:active {
            &:before {
                opacity: 1;
                transition: none;
            }

            &:has(button:active), &:has(select:active), &:has(label:active), &:has(textarea:active), &:has(input:not([type=radio]):not([type=checkbox]):active), &:has(.input:active) {
                &:before {
                    opacity: 0;
                }
            }
        }
    }

    &.no-color-highlight.selectable:not(.is-dragging) {
        &:after {
            background: $color-background-shade;
            background: var(--color-current-background-shade, $color-background-shade);
        }

        &:before {
            background: $color-background-shade-darker;
            background: var(--color-current-background-shade-darker, $color-background-shade-darker);
        }
    }

    &.sortable-chosen {
        transition: none;
        background: $color-background-shade;
        background: var(--color-current-background-shade, $color-background-shade);
    }

    &.sortable-chosen.is-dragging {
        touch-action: manipulation;
        user-select: none;
        transition: background-color 0.2s 0.1s;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        cursor: pointer;

        transition: none;
        background: none;
    }
}
</style>
