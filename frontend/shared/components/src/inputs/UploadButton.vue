<template>
    <component :is="elementName" class="upload-button">
        <LoadingButton :loading="uploading">
            <slot>
                <div class="button text only-icon-smartphone">
                    <span class="icon camera" />
                    <span>{{ text || "Uploaden" }}</span>
                </div>
            </slot>
        </LoadingButton>
        <input type="file" class="file-upload" accept="image/png, image/jpeg, image/svg+xml, image/webp" @change="changedFile">
    </component>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { useRequestOwner } from '@stamhoofd/networking';
import { Image, ResolutionRequest, Version } from '@stamhoofd/structures';
import { ref } from 'vue';

import type { Validator } from '../errors/Validator';
import { useContext } from '../hooks/useContext.ts';
import LoadingButton from '../navigation/LoadingButton.vue';
import { Toast } from '../overlays/Toast';

const model = defineModel<Image | null>({ default: null });

const props = withDefaults(defineProps<{
    elementName?: string;
    text?: string;
    validator?: Validator | null;
    resolutions?: ResolutionRequest[] | null;
}>(), {
    elementName: 'label',
    text: '',
    validator: null,
    resolutions: null,
});

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

    if (file.size > 5 * 1024 * 1024) {
        const error = new SimpleError({
            code: 'file_too_large',
            message: $t(`%z3`),
        });
        Toast.fromError(error).setHide(null).show();
        return;
    }

    const resolutions = props.resolutions ?? [ResolutionRequest.create({ height: 720 })];

    const formData = new FormData();
    formData.append('file', file);
    formData.append('resolutions', JSON.stringify(resolutions.map(r => r.encode({ version: Version }))));

    uploading.value = true;

    context.value.authenticatedServer
        .request({
            method: 'POST',
            path: '/upload-image',
            body: formData,
            decoder: Image as Decoder<Image>,
            timeout: 60 * 1000,
            shouldRetry: false,
            owner,
        })
        .then((response) => {
            model.value = response.data;
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
}

</style>
