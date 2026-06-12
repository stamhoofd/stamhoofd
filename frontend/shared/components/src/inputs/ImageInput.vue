<template>
    <STInputBox :title="title" error-fields="*" :error-box="errorBox">
        <label class="image-input-box" :class="{square: isSquare, dark, 'auto-height': defaultMaxHeight ? false : showImage}" @click="onClick">
            <span v-if="!required && modelValue" class="icon trash" />
            <span v-if="!required && !modelValue && placeholder" class="icon sync" />

            <Spinner v-if="uploading" />
            <ImageComponent v-else-if="modelValue === null && placeholder" :image="placeholder" :auto-height="true" :max-height="imageMaxHeight" />
            <span v-else-if="modelValue === null" class="icon upload" />
            <ImageComponent v-else :image="modelValue" :auto-height="true" :max-height="defaultMaxHeight ? 110 : imageMaxHeight" />
            <input type="file" class="file-upload" accept="image/png, image/jpeg, image/svg+xml" @change="changedFile">
        </label>
    </STInputBox>
</template>

<script setup lang="ts">
import type { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { Image, ResolutionRequest, Version } from '@stamhoofd/structures';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { computed, ref } from 'vue';

import { useContext } from '#hooks/useContext.ts';
import { ErrorBox } from '../errors/ErrorBox';
import type { Validator } from '../errors/Validator';
import Spinner from '../Spinner.vue';
import ImageComponent from '../views/ImageComponent.vue';
import STInputBox from './STInputBox.vue';

const props = withDefaults(
    defineProps<{
        title?: string;
        validator?: Validator | null;
        resolutions?: ResolutionRequest[] | null;
        placeholder?: Image | null;
        required?: boolean;
        dark?: boolean;
        isPrivate?: boolean;
        /**
         * Maximum height (in pixels) for the displayed image. The image is
         * always shown full width, capped to this height.
         *
         * - Omitted (undefined): defaults to the standard input height.
         * - null: no height cap.
         * - number: caps at that amount of pixels.
         */
        maxHeight?: number | null;
    }>(), {
        title: '',
        validator: null,
        resolutions: null,
        placeholder: null,
        required: true,
        dark: false,
        isPrivate: false,
        // Keep undefined as a distinct value (see maxHeight docs above).
        maxHeight: undefined,
    },
);

const modelValue = defineModel<Image | null>({ default: null });

const context = useContext();
const owner = useRequestOwner();

const errorBox = ref<ErrorBox | null>(null);
const uploading = ref(false);

const isSquare = computed(() => {
    if (props.resolutions === null) {
        return false;
    }
    return !!props.resolutions.every(r => r.width === r.height && r.width);
});

// Whether we are currently displaying an image (the uploaded value or the
// placeholder). In that case the box grows to fit the full-width image.
const showImage = computed(() => !uploading.value && (modelValue.value !== null || props.placeholder !== null));

// When maxHeight is omitted (undefined), we cap the image at the default input
// height via CSS. An explicit null removes the cap; a number caps at that value.
const defaultMaxHeight = computed(() => props.maxHeight === undefined);
const imageMaxHeight = computed(() => (typeof props.maxHeight === 'number' ? props.maxHeight : null));

function onClick(event: Event) {
    if (!props.required && modelValue.value) {
        event.preventDefault();
        modelValue.value = null;
    }
}

function changedFile(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) {
        return;
    }
    const target = event.target;

    if (!target.files || target.files.length !== 1) {
        return;
    }
    if (uploading.value) {
        return;
    }

    const file = target.files[0];

    if (file.size > 5 * 1024 * 1024) {
        errorBox.value = new ErrorBox(new SimpleError({
            code: 'file_too_large',
            message: $t(`%z3`),
        }));
        return;
    }

    const resolutions = props.resolutions ?? [ResolutionRequest.create({ height: 720 })];

    const formData = new FormData();
    formData.append('file', file);
    formData.append('resolutions', JSON.stringify(resolutions.map(r => r.encode({ version: Version }))));

    uploading.value = true;
    errorBox.value = null;

    Request.cancelAll(owner);
    context.value.authenticatedServer
        .request({
            method: 'POST',
            path: '/upload-image',
            body: formData,
            decoder: Image as Decoder<Image>,
            timeout: 60 * 1000,
            shouldRetry: false,
            owner,
            query: {
                private: props.isPrivate ? true : undefined,
            },
        })
        .then((response) => {
            modelValue.value = response.data;
        })
        .catch((e) => {
            console.error(e);
            errorBox.value = new ErrorBox(e);
        })
        .finally(() => {
            uploading.value = false;

            // Clear selection
            target.value = '';
        });
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.image-input-box {
    @extend %style-input;
    @extend %style-input-shadow;
    border: $border-width solid $color-gray-2;
    color: $color-gray-5;
    background: $color-background-shade;
    border-radius: $border-radius;
    padding: 5px 15px;
    height: 120px;
    margin: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.2s, color 0.2s;
    outline: none;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    cursor: pointer;
    touch-action: manipulation;
    position: relative;

    &.dark {
        @include dark-modus;
    }

    &:hover {
        border-color: $color-primary-gray-light;
        color: $color-primary;
    }

    &:active {
        border-color: $color-primary;
        color: $color-primary;
    }

    // Square only applies to the empty (placeholder) box. As soon as an image
    // is shown, the box grows to fit the full-width image.
    &.square {
        width: 120px;
    }

    // When an image is displayed, let the box grow to match the full-width
    // image (height follows the image's aspect ratio, capped by maxHeight).
    &.auto-height {
        height: auto;
        min-height: 120px;
        padding: 5px;
    }

    .file-upload {
        display: none;
    }

    .image-component {
        width: 100%;
        border-radius: $border-radius;
    }

    .icon.trash, .icon.sync {
        display: flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        background: $color-background;
        text-align: center;
        opacity: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        transition: opacity 0.2s;
        border-radius: $border-radius;
    }

    .icon.trash {
        color: $color-error;
    }

    &:hover {
        .icon.trash, .icon.sync {
            opacity: 1;
        }
    }
}

</style>
