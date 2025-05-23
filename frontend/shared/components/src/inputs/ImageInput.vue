<template>
    <STInputBox :title="title" error-fields="*" :error-box="errorBox">
        <label class="image-input-box" :class="{square: isSquare, dark}" @click="onClick">
            <span v-if="!required && modelValue" class="icon trash" />
            <span v-if="!required && !modelValue && placeholder" class="icon sync" />

            <Spinner v-if="uploading" />
            <img v-else-if="modelValue === null && placeholder" :src="placeholderSrc" :width="placeholderShownResolution.width" :height="placeholderShownResolution.height">
            <span v-else-if="modelValue === null" class="icon upload" />
            <img v-else :src="src" :width="shownResolution.width" :height="shownResolution.height">
            <input type="file" class="file-upload" accept="image/png, image/jpeg, image/svg+xml" @change="changedFile">
        </label>
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { Image, ResolutionRequest, Version } from '@stamhoofd/structures';

import { ErrorBox } from '../errors/ErrorBox';
import { Validator } from '../errors/Validator';
import Spinner from '../Spinner.vue';
import STInputBox from './STInputBox.vue';

@Component({
    components: {
        Spinner,
        STInputBox,
    },
    emits: ['update:modelValue'],
})
export default class ImageInput extends Mixins(NavigationMixin) {
    @Prop({ default: '' })
    title: string;

    @Prop({ default: null })
    validator: Validator | null;

    @Prop({ default: null })
    resolutions: ResolutionRequest[] | null;

    @Prop({ default: null })
    modelValue: Image | null;

    @Prop({ default: null })
    placeholder: Image | null;

    @Prop({ default: true })
    required!: boolean;

    @Prop({ default: false })
    dark!: boolean;

    @Prop({ default: false })
    isPrivate: boolean;

    errorBox: ErrorBox | null = null;

    uploading = false;

    get isSquare() {
        if (this.resolutions === null) {
            return false;
        }
        return !!this.resolutions.find(r => r.width === r.height && r.width);
    }

    get src() {
        return this.shownResolution.file.getPublicPath();
    }

    get shownResolution() {
        return this.modelValue!.getResolutionForSize(undefined, 220);
    }

    get placeholderSrc() {
        return this.placeholder!.getResolutionForSize(undefined, 220).file.getPublicPath();
    }

    get placeholderShownResolution() {
        return this.placeholder!.getResolutionForSize(undefined, 220);
    }

    onClick(event) {
        if (!this.required && this.modelValue) {
            event.preventDefault();
            this.$emit('update:modelValue', null);
        }
    }

    beforeUnmount() {
        Request.cancelAll(this);
    }

    changedFile(event) {
        if (!event.target.files || event.target.files.length !== 1) {
            return;
        }
        if (this.uploading) {
            return;
        }

        const file = event.target.files[0];

        if (file.size > 5 * 1024 * 1024) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'file_too_large',
                message: $t(`3d9d68f3-e953-46a4-b5cb-aa68aa0b1028`),
            }));
            return;
        }

        const resolutions = this.resolutions ?? [ResolutionRequest.create({ height: 720 })];

        const formData = new FormData();
        formData.append('file', file);
        formData.append('resolutions', JSON.stringify(resolutions.map(r => r.encode({ version: Version }))));

        this.uploading = true;
        this.errorBox = null;

        Request.cancelAll(this);
        this.$context.authenticatedServer
            .request({
                method: 'POST',
                path: '/upload-image',
                body: formData,
                decoder: Image,
                timeout: 60 * 1000,
                shouldRetry: false,
                owner: this,
                query: {
                    private: this.isPrivate ? true : undefined,
                },
            })
            .then((response) => {
                this.$emit('update:modelValue', response.data);
            })
            .catch((e) => {
                console.error(e);
                this.errorBox = new ErrorBox(e);
            })
            .finally(() => {
                this.uploading = false;

                // Clear selection
                event.target.value = null;
            });
    }
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
