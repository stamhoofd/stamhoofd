<template>
    <STInputBox :title="title" error-fields="*" :error-box="errorBox">
        <label class="file-input-box" :class="{ center: !model }">

            <Spinner v-if="uploading" />
            <span v-else-if="model === null" class="icon center upload" />

            <span v-if="model" :class="'icon '+getFileIcon(model)" />
            <span v-if="model" class="text">{{ model.name }}</span>

            <input type="file" class="file-upload" :accept="accept" @change="changedFile">
            <button v-if="!required && model" class="button icon trash" type="button" @click="deleteMe" @click.prevent="openFile" />
            <span v-if="required && model" class="button icon sync" />

            <button v-if="model" class="button icon external" type="button" @click.prevent="openFile" />
        </label>
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { useRequestOwner } from '@stamhoofd/networking';
import { File } from '@stamhoofd/structures';
import { ref } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import type { Validator } from '../errors/Validator';
import { useContext } from '../hooks/useContext.ts';
import Spinner from '../Spinner.vue';
import STInputBox from './STInputBox.vue';

const model = defineModel<File | null>({ default: null });

const props = withDefaults(defineProps<{
    title?: string;
    validator?: Validator | null;
    required?: boolean;
    isPrivate?: boolean;
    accept?: string;
}>(), {
    title: '',
    validator: null,
    required: true,
    isPrivate: false,
    accept: 'application/pdf',
});

const context = useContext();
const owner = useRequestOwner();

const errorBox = ref<ErrorBox | null>(null);
const uploading = ref(false);

function deleteMe() {
    model.value = null;
}

function openFile(event: MouseEvent) {
    if (model.value) {
        window.open(model.value.getPublicPath(), '_blank');
        event.preventDefault();
    }
}

function getFileIcon(file: File) {
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

    if (file.size > 20 * 1024 * 1024) {
        errorBox.value = new ErrorBox(new SimpleError({
            code: 'file_too_large',
            message: $t(`%yz`),
        }));
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    uploading.value = true;
    errorBox.value = null;

    context.value.authenticatedServer
        .request({
            method: 'POST',
            path: '/upload-file',
            body: formData,
            decoder: File,
            timeout: 5 * 60 * 1000,
            shouldRetry: false,
            owner,
            query: {
                private: props.isPrivate ? true : undefined,
            },
        })
        .then((response) => {
            model.value = response.data;
        })
        .catch((e) => {
            console.error(e);
            if (Request.isNetworkError(e)) {
                e = new SimpleError({
                    code: 'network_error',
                    message: $t(`%16m`),
                });
            }
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

.file-input-box {
    @extend %style-input;
    @extend %style-input-shadow;
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
