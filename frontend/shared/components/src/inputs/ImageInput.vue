<template>
    <STInputBox :title="title" error-fields="*" :error-box="errorBox">
        <label class="image-input-box" :class="{square: isSquare, dark}" @click="onClick">
            <span v-if="!required && modelValue" class="icon trash" />
            <span v-if="!required && !modelValue && placeholder" class="icon sync" />

            <Spinner v-if="uploading" />
            <img v-else-if="modelValue === null && placeholder" :src="placeholderSrc" :width="placeholderShownResolution.width" :height="placeholderShownResolution.height">
            <span v-else-if="modelValue === null" class="icon upload" />
            <img v-else :src="src" :width="shownResolution!.width" :height="shownResolution!.height">
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
    }>(), {
        title: '',
        validator: null,
        resolutions: null,
        placeholder: null,
        required: true,
        dark: false,
        isPrivate: false,
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
    return !!props.resolutions.find(r => r.width === r.height && r.width);
});

const shownResolution = computed(() => modelValue.value?.getResolutionForSize(undefined, 220));

const src = computed(() => shownResolution.value!.file.getPublicPath());

const placeholderShownResolution = computed(() => props.placeholder!.getResolutionForSize(undefined, 220));

const placeholderSrc = computed(() => placeholderShownResolution.value.file.getPublicPath());

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
    @extend .style-input;
    @extend .style-input-shadow;
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

    &.square {
        width: 120px;
    }

    .file-upload {
        display: none;
    }

    img {
        position: absolute; // fix max width
        max-height: 110px;
        max-width: calc(100% - 10px);
        height: auto;
        width: auto;
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
