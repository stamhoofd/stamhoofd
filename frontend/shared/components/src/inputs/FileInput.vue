<template>
    <STInputBox :title="title" error-fields="*" :error-box="errorBox">
        <label class="file-input-box" :class="{ center: !modelValue }">

            <Spinner v-if="uploading" />
            <span v-else-if="modelValue === null" class="icon center upload" />

            <span v-if="modelValue" :class="'icon '+getFileIcon(modelValue)" />
            <span v-if="modelValue" class="text">{{ modelValue.name }}</span>

            <input type="file" class="file-upload" :accept="accept" @change="changedFile">
            <button v-if="!required && modelValue" class="button icon trash" type="button" @click="deleteMe" @click.prevent="openFile" />
            <span v-if="required && modelValue" class="button icon sync" />

            <button v-if="modelValue" class="button icon external" type="button" @click.prevent="openFile" />
        </label>
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { File } from '@stamhoofd/structures';

import { ErrorBox } from '../errors/ErrorBox';
import { Validator } from '../errors/Validator';
import Spinner from '../Spinner.vue';
import STInputBox from './STInputBox.vue';

@Component({
    components: {
        Spinner,
        STInputBox,
    },
})
export default class FileInput extends Mixins(NavigationMixin) {
    @Prop({ default: '' })
    title: string;

    @Prop({ default: null })
    validator: Validator | null;

    @Prop({ default: null })
    modelValue: File | null;

    @Prop({ default: true })
    required!: boolean;

    @Prop({ default: false })
    isPrivate: boolean;

    @Prop({ default: 'application/pdf' })
    accept: string;

    errorBox: ErrorBox | null = null;

    uploading = false;

    deleteMe() {
        this.$emit('update:modelValue', null);
    }

    openFile(event: MouseEvent) {
        if (this.modelValue) {
            window.open(this.modelValue.getPublicPath(), '_blank');
            event.preventDefault();
        }
    }

    getFileIcon(file: File) {
        if (file.path.endsWith('.png') || file.path.endsWith('.jpg') || file.path.endsWith('.jpeg') || file.path.endsWith('.gif')) {
            return 'file-image';
        }
        if (file.path.endsWith('.pdf')) {
            return 'file-pdf color-pdf';
        }
        if (file.path.endsWith('.xlsx') || file.path.endsWith('.xls')) {
            return 'file-excel color-excel';
        }
        if (file.path.endsWith('.docx') || file.path.endsWith('.doc')) {
            return 'file-word color-word';
        }
        return 'file';
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

        if (file.size > 20 * 1024 * 1024) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'file_too_large',
                message: $t(`97f9599f-cfdd-4705-a94e-8ec6351e99d4`),
            }));
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        this.uploading = true;
        this.errorBox = null;

        this.$context.authenticatedServer
            .request({
                method: 'POST',
                path: '/upload-file',
                body: formData,
                decoder: File,
                timeout: 5 * 60 * 1000,
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
                if (Request.isNetworkError(e)) {
                    e = new SimpleError({
                        code: 'network_error',
                        message: $t(`b9912181-cf0a-4c85-bb9a-fc9ee7fa54f5`),
                    });
                }
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

.file-input-box {
    @extend .style-input;
    @extend .style-input-shadow;
    border: $border-width solid $color-border;
    color: $color-gray-5;
    background: $color-background;
    border-radius: $border-radius;
    padding: 5px 15px;
    height: 50px;
    margin: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    transition: border-color 0.2s, color 0.2s;
    outline: none;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    cursor: pointer;
    touch-action: manipulation;
    position: relative;

    > .text {
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        padding-right: 5px;
    }

    &.center {
        justify-content: center;
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
        width: 60px;
    }

    .file-upload {
        display: none;
    }

    .icon:first-child {
        margin-right: 10px;

        &+ span {
            color: $color-dark;
        }
    }

    .icon {
        flex-shrink: 0;
        color: $color-gray-4;
    }

    .button.icon {
        margin-left: auto;

        ~ .button.icon {
            margin-left: 10px;
        }
    }

    .icon.trash {
        color: $color-error;
        opacity: 0;
        transition: opacity 0.2s;

        &:hover {
            opacity: 1;
        }
    }

    &:hover {
        .icon.trash {
            opacity: 1;
        }
    }
}

</style>
