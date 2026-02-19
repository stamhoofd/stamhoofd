<template>
    <component
        :is="dynamicElementName"
        class="st-grid-item"
        :class="[{
            selectable,
            hoverable,
            disabled,
            button: dynamicElementName === 'button'
        }, $attrs.class]"
        :type="dynamicElementName === 'button' ? 'button' : undefined"
        v-bind="$attrs"
        @click="$emit('click', $event)"
        @contextmenu="$emit('contextmenu', $event)"
    >
        <div v-if="$slots.left" class="left">
            <slot name="left" />
        </div>
        <div v-if="$slots.default" class="middle">
            <slot />
        </div>
        <div v-if="$slots.middleRight" class="middle-right">
            <slot name="middleRight" />
        </div>
        <div v-if="$slots.right" class="right">
            <slot name="right" />
        </div>

        <div class="line" />
    </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';

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
const emit = defineEmits(['click', 'contextmenu']);
const dynamicElementName = computed(() => (props.elementName === 'article' && props.selectable && !props.disabled) ? 'button' : props.elementName);
const hoverable = computed(() => dynamicElementName.value === 'button' || dynamicElementName.value === 'label');
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables" as *;
@use "@stamhoofd/scss/base/text-styles" as *;

a.st-grid-item {
  &,
  &:hover,
  &:active,
  &:visited,
  &:link {
    color: inherit;
    text-decoration: inherit;
  }
}

button.st-grid-item {
  text-align: inherit;
}

.st-grid-item {
    @extend .style-normal;
    display: grid;
    grid-column: start / end;
    grid-template-columns: subgrid;
    gap: 0;

    &.header {
        font-weight: $font-weight-semibold;
    }

    &.selected {
        color: $color-primary;
    }

    > .left {
        grid-row: 1;
        grid-column: 2;
        padding-right: 15px;
    }

    > .middle {
        grid-row: 1;
        grid-column: 3;
        padding-right: 15px;
    }

    > .middle-right {
        grid-row: 1;
        grid-column: 4;
        padding-right: 15px;

        > .style-price-base {
            text-align: right;
        }
    }

    > .right {
        grid-row: 1;
        grid-column: 5;
    }

    &.price-grid {
        > .middle-right {
            text-align: right;
        }

        > .right {
            text-align: right;
        }

        // Increase margin between middle-right and right on larger displays
        @media (min-width: 600px) {
            > .middle-right {
                padding-right: 60px;
            }
        }
    }

    > .line {
        border: 0;
        outline: 0;
        grid-column: line-start / line-end;
        grid-row: 1;
        height: $border-width-thin;
        background: $color-border;
        border-radius: $border-width-thin/2;
        position: relative;
        align-self: end;

        margin-bottom: calc(-1 * var(--st-list-padding, 15px));
    }

    &:last-child {
        > .line {
            display: none;
        }
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
            top: calc(-1 * var(--st-list-padding, 15px));
            left: 0;
            right: 0;
            bottom: calc(-1 * var(--st-list-padding, 15px));
            background: $color-primary-lighter;
            z-index: -3;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.1s;
        }

        &:before {
            // This is the click layer
            content: '';
            position: absolute;
            top: calc(-1 * var(--st-list-padding, 15px));
            left: 0;
            right: 0;
            bottom: calc(-1 * var(--st-list-padding, 15px));
            background: $color-primary-light;
            z-index: -1;
            opacity: 0;
            pointer-events: none;

            // Slow fade out
            transition: opacity 0.4s 0.1s;
        }

        @media (pointer: fine) {
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

}
</style>
