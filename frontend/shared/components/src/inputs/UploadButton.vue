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

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Image, ResolutionRequest, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';

import { Validator } from '../errors/Validator';
import LoadingButton from '../navigation/LoadingButton.vue';
import { Toast } from '../overlays/Toast';
import STInputBox from './STInputBox.vue';

@Component({
    components: {
        STInputBox,
        LoadingButton,
    },
})
export default class UploadButton extends Mixins(NavigationMixin) {
    @Prop({ default: 'label' })
    elementName!: string;

    @Prop({ default: '' })
    text: string;

    @Prop({ default: null })
    validator: Validator | null;

    @Prop({ default: null })
    resolutions: ResolutionRequest[] | null;

    @Prop({ default: null })
    modelValue: Image | null;

    uploading = false;

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
        Request.cancelAll(this);

        const file = event.target.files[0];

        if (file.size > 5 * 1024 * 1024) {
            const error = new SimpleError({
                code: 'file_too_large',
                message: $t(`3d9d68f3-e953-46a4-b5cb-aa68aa0b1028`),
            });
            Toast.fromError(error).setHide(null).show();
            return;
        }

        const resolutions = this.resolutions ?? [ResolutionRequest.create({ height: 720 })];

        const formData = new FormData();
        formData.append('file', file);
        formData.append('resolutions', JSON.stringify(resolutions.map(r => r.encode({ version: Version }))));

        this.uploading = true;
        // this.errorBox = null;

        this.$context.authenticatedServer
            .request({
                method: 'POST',
                path: '/upload-image',
                body: formData,
                decoder: Image,
                timeout: 60 * 1000,
                shouldRetry: false,
                owner: this,
            })
            .then((response) => {
                this.$emit('update:modelValue', response.data);
            })
            .catch((e) => {
                console.error(e);
                Toast.fromError(e).setHide(null).show();
                // this.errorBox = new ErrorBox(e)
                // TODO!
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

.upload-button {
    .file-upload {
        display: none;
    }
}

</style>
