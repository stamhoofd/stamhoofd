<template>
    <component
        :is="elementName"
        class="st-card"
        :class="{ selectable, disabled }"
        :type="elementName === 'button' ? 'button' : undefined"
        :disabled="elementName === 'button' && disabled ? true : undefined"
        @click="$emit('click', $event)"
    >
        <div v-if="$slots.left" class="st-card-left">
            <slot name="left" />
        </div>
        <div class="st-card-main">
            <div v-if="title || $slots.title || $slots.right || selectable" class="st-card-header">
                <div class="st-card-heading">
                    <h3 v-if="title || $slots.title" class="st-card-title">
                        <slot name="title">{{ title }}</slot>
                    </h3>
                    <p v-if="description || $slots.description" class="st-card-description">
                        <slot name="description">{{ description }}</slot>
                    </p>
                </div>
                <div v-if="$slots.right || selectable" class="st-card-right">
                    <slot name="right" />
                    <span v-if="selectable" class="icon arrow-right-small gray" />
                </div>
            </div>
            <div v-if="$slots.default" class="st-card-body">
                <slot />
            </div>
        </div>
    </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        title?: string;
        description?: string;
        /**
         * The whole card acts as a button and shows an arrow
         */
        selectable?: boolean;
        disabled?: boolean;
    }>(),
    {
        title: '',
        description: '',
        selectable: false,
        disabled: false,
    },
);

defineEmits(['click']);

const elementName = computed(() => props.selectable ? 'button' : 'div');
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.st-card {
    display: flex;
    gap: 15px;
    align-items: flex-start;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
    padding: 15px 20px;
    border: $border-width solid $color-border;
    border-radius: $border-radius;
    background: var(--color-current-background, #{$color-background});
    color: $color-dark;
    transition: background-color 0.2s, border-color 0.2s;

    &.selectable {
        cursor: pointer;

        @media (hover: hover) {
            &:hover {
                background: $color-background-shade;
            }
        }

        &:active {
            background: $color-background-shade-darker;
        }
    }

    &.disabled {
        opacity: 0.5;
        cursor: default;
    }

    > .st-card-left {
        flex-shrink: 0;
        padding-top: 2px;
    }

    > .st-card-main {
        flex-grow: 1;
        min-width: 0;
    }

    .st-card-header {
        display: flex;
        gap: 15px;
        align-items: center;
    }

    .st-card-heading {
        flex-grow: 1;
        min-width: 0;
    }

    .st-card-title {
        @extend %style-title-list;
    }

    .st-card-description {
        @extend %style-description-small;
        padding-top: 3px;
    }

    .st-card-right {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .st-card-body {
        // Separator lines of lists inside the card run from border to border
        --st-horizontal-padding: 20px;

        > p {
            @extend %style-description;
        }

        > .st-list {
            margin: -5px 0;
        }

        > .button {
            margin-top: 10px;
        }
    }

    .st-card-header + .st-card-body {
        padding-top: 10px;

        > .st-list {
            margin-top: 0;
        }
    }

    &.center > .st-card-main {
        text-align: center;
    }
}
</style>
