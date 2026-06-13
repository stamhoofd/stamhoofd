<template>
    <component :is="elementName" class="upload-button">
        <LoadingButton :loading="uploading">
            <slot>
                <div class="button text only-icon-smartphone">
                    <span class="icon attachment" />
                    <span>{{ text || "Uploaden" }}</span>
                </div>
            </slot>
        </LoadingButton>
        <input type="file" class="file-upload" :accept="accept" @change="changedFile">
    </component>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { File } from '@stamhoofd/structures';
import { ref } from 'vue';

import { useContext } from '../hooks/useContext.ts';
import LoadingButton from '../navigation/LoadingButton.vue';
import { Toast } from '../overlays/Toast';

const props = withDefaults(defineProps<{
    elementName?: string;
    text?: string;
    accept?: string;
    isPrivate?: boolean;
    maxSize?: number;
}>(), {
    elementName: 'label',
    text: '',
    accept: '',
    isPrivate: false,
    maxSize: 20 * 1024 * 1024,
});

const emit = defineEmits<{
    (e: 'change', file: File): void;
}>();

const context = useContext();
const owner = useRequestOwner();

const uploading = ref(false);

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
    Request.cancelAll(owner);

    const file = target.files[0];

    if (file.size > props.maxSize) {
        const error = new SimpleError({
            code: 'file_too_large',
            message: $t(`%yz`),
        });
        Toast.fromError(error).setHide(null).show();
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    uploading.value = true;

    context.value.authenticatedServer
        .request({
            method: 'POST',
            path: '/upload-file',
            body: formData,
            decoder: File as Decoder<File>,
            timeout: 5 * 60 * 1000,
            shouldRetry: false,
            owner,
            query: {
                private: props.isPrivate ? true : undefined,
            },
        })
        .then((response) => {
            emit('change', response.data);
        })
        .catch((e) => {
            console.error(e);
            Toast.fromError(e).setHide(null).show();
        })
        .finally(() => {
            uploading.value = false;

            // Clear selection
            target.value = '';
        });
}
</script>

<style lang="scss">

.upload-button {
    .file-upload {
        display: none;
    }

    .loading-button {
        display: block;
    }
}

</style>
