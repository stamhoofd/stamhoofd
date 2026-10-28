<template>
    <div class="image-drop-area-container">
        <label
            class="image-drop-area"
            :class="{ dragging, 'has-image': !!modelValue }"
            data-testid="image-drop-area"
            @dragenter.prevent="onDragEnter"
            @dragover.prevent
            @dragleave="onDragLeave"
            @drop.prevent="onDrop"
        >
            <input type="file" class="file-upload" :accept="accept" @change="onChangeFile">

            <template v-if="modelValue">
                <ImageComponent :image="modelValue" :auto-height="true" :max-height="maxHeight" />
                <div class="actions">
                    <span class="button text">
                        <span class="icon sync" />
                        <span>{{ $t('%He') }}</span>
                    </span>
                    <button class="button text error" type="button" data-testid="image-drop-area-delete" @click.prevent.stop="modelValue = null">
                        <span class="icon trash" />
                        <span>{{ $t('%CJ') }}</span>
                    </button>
                </div>
            </template>
            <div v-else class="empty">
                <span class="icon image" />
                <h3 class="style-title-list">
                    {{ title }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%a09') }}
                </p>
                <p v-if="description" class="style-description-small">
                    {{ description }}
                </p>
            </div>

            <div v-if="uploading" class="uploading">
                <Spinner />
            </div>
        </label>
        <STErrorsDefault :error-box="errorBox" />
    </div>
</template>

<script setup lang="ts">
import type { Image, ResolutionRequest } from '@stamhoofd/structures';
import { ref } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { useImageUpload } from '../hooks/useImageUpload.ts';
import Spinner from '../Spinner.vue';
import ImageComponent from '../views/ImageComponent.vue';

const props = withDefaults(
    defineProps<{
        title: string;
        description?: string;
        resolutions?: ResolutionRequest[] | null;
        maxHeight?: number | null;
        isPrivate?: boolean;
    }>(), {
        description: '',
        resolutions: null,
        maxHeight: 300,
        isPrivate: false,
    },
);

const modelValue = defineModel<Image | null>({ default: null });

const accept = 'image/png, image/jpeg, image/svg+xml, image/webp';
const errorBox = ref<ErrorBox | null>(null);

// dragenter and dragleave also fire when moving over child elements, so count them
const dragDepth = ref(0);
const dragging = ref(false);

const { uploading, upload } = useImageUpload({
    resolutions: () => props.resolutions,
    isPrivate: () => props.isPrivate,
});

async function uploadFile(file: File) {
    if (uploading.value) {
        return;
    }
    errorBox.value = null;
    try {
        modelValue.value = await upload(file);
    } catch (e) {
        console.error(e);
        errorBox.value = new ErrorBox(e);
    }
}

async function onChangeFile(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) {
        return;
    }
    const target = event.target;
    const file = target.files?.[0];
    if (!file) {
        return;
    }
    await uploadFile(file);
    target.value = '';
}

function onDragEnter() {
    dragDepth.value += 1;
    dragging.value = true;
}

function onDragLeave() {
    dragDepth.value = Math.max(0, dragDepth.value - 1);
    if (dragDepth.value === 0) {
        dragging.value = false;
    }
}

async function onDrop(event: DragEvent) {
    dragDepth.value = 0;
    dragging.value = false;

    const file = event.dataTransfer?.files[0];
    if (!file) {
        return;
    }
    await uploadFile(file);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.image-drop-area-container {
    padding-bottom: 20px;
}

.image-drop-area {
    position: relative;
    display: block;
    border-radius: $border-radius;
    cursor: pointer;
    overflow: hidden;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    touch-action: manipulation;

    .file-upload {
        display: none;
    }

    &:not(.has-image) {
        border: $border-width solid $color-border;
        background: $color-background-shade;
        transition: border-color 0.2s, background-color 0.2s;

        &:hover {
            border-color: $color-primary-gray-light;
        }
    }

    &.dragging {
        border-color: $color-primary;
        background: $color-primary-background;

        &.has-image {
            outline: 2px solid $color-primary;
            outline-offset: -2px;
        }
    }

    > .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-height: 180px;
        padding: 20px;
        box-sizing: border-box;
        text-align: center;

        > .icon {
            color: $color-gray-5;
            margin-bottom: 4px;
        }
    }

    &:hover > .empty > .icon, &.dragging > .empty > .icon {
        color: $color-primary;
    }

    // Always fill the full width like the webshop does, crop when the photo exceeds maxHeight
    .image-component {
        width: 100%;

        img {
            object-fit: cover;
        }
    }

    > .actions {
        position: absolute;
        right: 10px;
        bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        opacity: 0;
        transition: opacity 0.2s;

        @media (hover: none) {
            opacity: 1;
        }

        // White underlay so the text buttons stay readable on top of any photo
        > .button {
            box-sizing: border-box;
            height: 34px;
            line-height: 1;
            padding: 0 12px;
            background: $color-background;
            border-radius: $border-radius;
            transition: background-color 0.2s, color 0.2s;

            @media (hover: hover) {
                &:hover {
                    opacity: 1;
                    background: $color-background-shade;
                }
            }
        }
    }

    &:hover > .actions, &:focus-within > .actions {
        opacity: 1;
    }

    > .uploading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: $color-background;
        opacity: 0.8;
    }
}
</style>
