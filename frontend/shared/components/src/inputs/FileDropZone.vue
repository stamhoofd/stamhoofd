<template>
    <label
        class="file-drop-zone"
        :class="{ dragging, disabled: disabled || loading }"
        @pointermove="trackPointer"
        @dragover="trackPointer"
    >
        <Spinner v-if="loading" />
        <span v-else :class="'icon ' + icon" />

        <span class="style-title-list">
            {{ title }}
        </span>
        <span v-if="description" class="style-description-small">
            {{ description }}
        </span>
        <input type="file" :accept="accept" :disabled="disabled || loading" @change="onChangeFile">
    </label>
</template>

<script setup lang="ts">
import Spinner from '../Spinner.vue';

/**
 * A place to drop or click to pick a file. Where the dragged file is let go is up to the parent, which
 * can accept a drop on the whole view and tells this zone through `dragging` to light up.
 */
withDefaults(
    defineProps<{
        title: string;
        description?: string;
        accept?: string;
        icon?: string;
        dragging?: boolean;
        loading?: boolean;
        disabled?: boolean;
    }>(), {
        description: '',
        accept: '',
        icon: 'upload',
        dragging: false,
        loading: false,
        disabled: false,
    },
);

const emit = defineEmits<{ select: [file: File] }>();

/** Where the pointer is, so the part of the border closest to it lights up */
function trackPointer(event: PointerEvent | DragEvent) {
    if (!(event.currentTarget instanceof HTMLElement)) {
        return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
}

function onChangeFile(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) {
        return;
    }
    const target = event.target;
    const file = target.files?.[0];
    if (file) {
        emit('select', file);
    }
    // Clear the selection, so picking the same file again still fires a change event
    target.value = '';
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.file-drop-zone {
    --pointer-x: 50%;
    --pointer-y: 50%;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 30px 20px;
    border: $border-width solid $color-border;
    border-radius: $border-radius;
    background: $color-background-shade;
    color: $color-dark;
    text-align: center;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.2s, border-color 0.2s;

    > input {
        display: none;
    }

    > .icon, > .spinner-container {
        margin-bottom: 10px;
    }

    > .style-title-list, > .style-description-small {
        display: block;
    }

    // The border lights up around the pointer: a gradient that only shows in the width of the border
    &::before {
        content: "";
        position: absolute;
        inset: calc(-1 * #{$border-width});
        padding: 1.5px;
        border-radius: inherit;
        background: radial-gradient(160px circle at var(--pointer-x) var(--pointer-y), $color-primary, transparent);
        mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
    }

    &:hover::before {
        opacity: 1;
    }

    &.dragging {
        border-color: $color-primary;
        background: $color-primary-background;

        &::before {
            opacity: 1;
            background: radial-gradient(220px circle at var(--pointer-x) var(--pointer-y), $color-primary, transparent);
        }
    }

    &.disabled {
        cursor: default;
        opacity: 0.6;
        pointer-events: none;
    }
}
</style>
